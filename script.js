var mymap;
var userLocationMarker = null; // Marker za trenutnu lokaciju korisnika
var routingControl = null; // Kontrola za iscrtavanje rute
var waypointMarkers = []; // Array to keep track of waypoint markers

document.addEventListener("DOMContentLoaded", function () {
  mymap = L.map("mapid").setView([44.78996198723505, 20.466267089843704], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(mymap);
  plotInitialWaypoints();

  const checkboxes = document.querySelectorAll("input[type=checkbox]");
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", filterWaypoints);
  });
});

async function geocode(address) {
  const proxyUrl = "https://cors-anywhere.herokuapp.com/";
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}`;
  const url = proxyUrl + nominatimUrl;
  try {
    const response = await fetch(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    if (!response.ok)
      throw new Error(`Geokodiranje neuspešno: ${response.statusText}`);
    const data = await response.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } else {
      throw new Error("Adresa nije pronađena: " + address);
    }
  } catch (error) {
    console.error("Greška pri geokodiranju:", error);
    throw error;
  }
}

// Data structure for waypoints with fill percentages for each material
var waypoints = [
  {
    address: "Maksima Gorkog, Beograd 11000",
    materials: { papir: 20, plastika: 95, metal: 60 },
  },
  {
    address: "Zivka Davidovica 86, Beograd 11055",
    materials: { papir: 45, plastika: 95, metal: 65 },
  },
  {
    address: "Mirijevski bulevar 18b, Beograd 11000",
    materials: { papir: 30, plastika: 95, metal: 50 },
  },
  {
    address: "Carlija Caplina 39, Beograd 11000",
    materials: { papir: 55, plastika: 35, metal: 95 },
  },
  {
    address: "Kneza Mihaila 54, Beograd 11000",
    materials: { papir: 70, plastika: 85, metal: 40 },
  },
  {
    address: "Bulevar Mihajla Pupina 4, Beograd 11070",
    materials: { papir: 95, plastika: 35, metal: 65 },
  },
  {
    address: "Bulevar umetnosti 4, Beograd",
    materials: { papir: 95, plastika: 25, metal: 60 },
  },
  {
    address: "Jurija Gagarina 16, Beograd",
    materials: { papir: 55, plastika: 25, metal: 85 },
  },
  {
    address: "Pozeska 83a, Beograd 11030",
    materials: { papir: 95, plastika: 15, metal: 65 },
  },
  {
    address: "Paunova 24, Beograd 11000",
    materials: { papir: 10, plastika: 50, metal: 95 },
  },
  {
    address: "Milenka Vesnica 3, Beograd 11000",
    materials: { papir: 95, plastika: 40, metal: 70 },
  },
];

function determineBarColor(fillPercentage) {
  if (fillPercentage < 50) {
    return "#4CAF50"; // Green for low fill levels
  } else if (fillPercentage < 75) {
    return "#ffe02d"; // Yellow for medium fill levels
  } else {
    return "#F44336"; // Red for high fill levels
  }
}

function generateProgressBarHTML(material, fillPercentage) {
  const barColor = determineBarColor(fillPercentage);
  return `
      <div style="margin-top: 5px;">
          <strong>${material}:</strong>
          <div style="background-color: #ddd; height: 20px; position: relative; width: 100%;">
              <div style="height: 20px; width: ${fillPercentage}%; background-color: ${barColor}; display: flex; align-items: center; color: black; font-weight: bold; padding-left: 5px">
                  ${fillPercentage.toFixed(0)}%
              </div>
          </div>
      </div>
  `;
}

async function plotInitialWaypoints() {
  waypoints.forEach(async (waypoint) => {
    const latLng = await geocode(waypoint.address);
    const popupContent = `
          <div>
              <h4>Lokacija: ${waypoint.address}</h4>
              ${generateProgressBarHTML("Papir", waypoint.materials.papir)}
              ${generateProgressBarHTML(
                "Plastika",
                waypoint.materials.plastika
              )}
              ${generateProgressBarHTML("Metal", waypoint.materials.metal)}
          </div>
      `;
    const marker = L.marker(latLng, { draggable: false })
      .bindPopup(popupContent)
      .addTo(mymap);
    waypoint.marker = marker;
    waypointMarkers.push(marker);
  });
}

function filterWaypoints() {
  const papirChecked = document.getElementById("papirCheckbox").checked;
  const plastikaChecked = document.getElementById("plastikaCheckbox").checked;
  const metalChecked = document.getElementById("metalCheckbox").checked;

  waypointMarkers.forEach((marker) => mymap.removeLayer(marker));

  waypoints.forEach((waypoint) => {
    const papirFill = waypoint.materials.papir;
    const plastikaFill = waypoint.materials.plastika;
    const metalFill = waypoint.materials.metal;

    if (
      (!papirChecked || (papirChecked && papirFill < 90)) &&
      (!plastikaChecked || (plastikaChecked && plastikaFill < 90)) &&
      (!metalChecked || (metalChecked && metalFill < 90))
    ) {
      const latLng = [
        waypoint.marker.getLatLng().lat,
        waypoint.marker.getLatLng().lng,
      ];
      const popupContent = `
        <div>
          <h4>Lokacija: ${waypoint.address}</h4>
          ${generateProgressBarHTML("Papir", waypoint.materials.papir)}
          ${generateProgressBarHTML("Plastika", waypoint.materials.plastika)}
          ${generateProgressBarHTML("Metal", waypoint.materials.metal)}
        </div>
      `;
      const marker = L.marker(latLng, { draggable: false })
        .bindPopup(popupContent)
        .addTo(mymap);
      waypoint.marker = marker;
      waypointMarkers.push(marker);
    }
  });
}

async function findNearestAndPlotRoute() {
  const userAddress = document.getElementById("address").value; // Uzimanje adrese od korisnika

  // Uklanjanje prethodnog markera i rute, ako postoje
  if (userLocationMarker) {
    mymap.removeLayer(userLocationMarker);
    userLocationMarker = null;
  }
  if (routingControl) {
    mymap.removeControl(routingControl);
    routingControl = null;
  }

  try {
    const userLatLng = await geocode(userAddress); // Geokodiranje korisničke adrese
    let nearestMarker = null; // Marker najbliže tačke
    let nearestDistance = Infinity; // Inicijalna najveća udaljenost
    let nearestLatLng = null; // Koordinate najbliže tačke

    // Iteracija kroz sve markere na mapi i pronalaženje najbližeg
    mymap.eachLayer(function (layer) {
      if (layer instanceof L.Marker) {
        const distance = mymap.distance(layer.getLatLng(), userLatLng); // Izračunavanje udaljenosti
        if (distance < nearestDistance) {
          // Ažuriranje najbliže tačke
          nearestDistance = distance;
          nearestMarker = layer;
          nearestLatLng = layer.getLatLng();
        }
      }
    });

    // Uklanjanje svih markera osim najbližeg
    mymap.eachLayer(function (layer) {
      if (!(layer instanceof L.TileLayer) && layer !== nearestMarker) {
        mymap.removeLayer(layer);
      }
    });

    // Dodavanje markera za korisničku lokaciju
    userLocationMarker = L.marker([userLatLng[0], userLatLng[1]], {
      title: "Vaša lokacija",
    }).addTo(mymap);

    // Iscrtavanje rute do najbliže tačke
    if (nearestLatLng) {
      routingControl = L.Routing.control({
        waypoints: [L.latLng(userLatLng[0], userLatLng[1]), nearestLatLng],
        routeWhileDragging: false,
      }).addTo(mymap);
    }
  } catch (error) {
    alert(error.message); // Prikazivanje greške korisniku
  }
}
