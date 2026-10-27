// QueensVoice

var langs = [];
var clinics = [];    // these report languages
var community = [];  // these dont
var cur = null;      // language picked
var my_loc = null;
var shown = [];
var pins = [];

var map, clinicPins, commPins;


// haversine, miles
function dist(lat1, lon1, lat2, lon2) {
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}


async function start() {
  langs = await (await fetch("data/languages.json")).json();
  clinics = await (await fetch("data/services.json")).json();
  community = await (await fetch("data/community.json")).json();

  langs.unshift({
    name: "All languages", native: "All languages", sub: "every clinic in Queens",
    tag: "en", all: true, sites: clinics.length
  });

  showLangs(langs);
}
start();


function showLangs(list) {
  var html = "";
  for (var i = 0; i < list.length; i++) {
    var l = list[i];
    html += '<div class="lang" data-name="' + l.name + '">';
    html += '<div class="native" lang="' + l.tag + '">' + l.native + "</div>";
    html += '<div class="en">' + (l.sub ? l.sub : l.name) + "</div>";
    html += '<div class="count">' + l.sites +
      (l.sites == 1 ? " place" : " places") + "</div>";
    html += "</div>";
  }
  document.getElementById("langs").innerHTML = html;
}


document.getElementById("langs").onclick = function (e) {
  var box = e.target.closest(".lang");
  if (!box) return;
  for (var i = 0; i < langs.length; i++) {
    if (langs[i].name == box.dataset.name) pick(langs[i]);
  }
};


document.getElementById("back").onclick = function () {
  document.getElementById("main").className = "hide";
  document.getElementById("pick").className = "";
};


function pick(lang) {
  cur = lang;
  document.getElementById("pick").className = "hide";
  document.getElementById("main").className = "";

  if (lang.all) {
    document.getElementById("langname").innerText = lang.name;
  } else {
    document.getElementById("langname").innerText = lang.native + " · " + lang.name;
  }

  // clear the old search
  document.getElementById("search").value = "";

  makeMap();
  update();
}


function makeMap() {
  if (map) return;

  map = L.map("map", { zoomControl: false }).setView([40.7152, -73.8272], 12);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  clinicPins = makeCluster("");
  commPins = makeCluster(" grey");
  map.addLayer(clinicPins);
  map.addLayer(commPins);

  document.getElementById("search").oninput = update;
  document.getElementById("comm").onchange = update;
  document.getElementById("loc").onclick = findMe;
}


function makeCluster(color) {
  return L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 45,
    iconCreateFunction: function (c) {
      return L.divIcon({
        html: '<div class="cluster' + color + '">' + c.getChildCount() + "</div>",
        className: "",
        iconSize: [34, 34]
      });
    }
  });
}


// redraws everything
function update() {
  var list = [];

  for (var i = 0; i < clinics.length; i++) {
    if (cur.all || clinics[i].languages.indexOf(cur.name) > -1) {
      clinics[i].speaks = true;
      list.push(clinics[i]);
    }
  }

  if (document.getElementById("comm").checked) {
    for (var i = 0; i < community.length; i++) {
      community[i].speaks = false;
      list.push(community[i]);
    }
  }

  for (var i = 0; i < list.length; i++) {
    if (my_loc) {
      list[i].miles = dist(my_loc[0], my_loc[1], list[i].lat, list[i].lon);
    } else {
      list[i].miles = null;
    }
  }

  // nearest first, otherwise clinics above community
  list.sort(function (a, b) {
    if (my_loc) return a.miles - b.miles;
    if (a.speaks != b.speaks) return a.speaks ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  var q = document.getElementById("search").value.trim();
  if (q != "") {
    var f = new Fuse(list, { keys: ["name", "city", "zip"], threshold: 0.35 });
    var hits = f.search(q);
    list = [];
    for (var i = 0; i < hits.length; i++) list.push(hits[i].item);
  }

  shown = list;
  drawPins();
  drawList();
}


function drawPins() {
  clinicPins.clearLayers();
  commPins.clearLayers();
  pins = [];

  var box = [];
  for (var i = 0; i < shown.length; i++) {
    var p = shown[i];
    var m = L.marker([p.lat, p.lon], {
      title: p.name,
      icon: L.divIcon({
        html: '<div class="pin' + (p.speaks ? "" : " grey") + '"></div>',
        className: "",
        iconSize: p.speaks ? [14, 14] : [10, 10]
      })
    });
    m.bindPopup(popupFor(p), { maxWidth: 260 });

    if (p.speaks) {
      clinicPins.addLayer(m);
      pins.push({ marker: m, group: clinicPins });
    } else {
      commPins.addLayer(m);
      pins.push({ marker: m, group: commPins });
    }
    box.push([p.lat, p.lon]);
  }

  if (box.length > 0) map.fitBounds(box, { padding: [50, 50], maxZoom: 14 });
}


function drawList() {
  var html = "";

  if (shown.length == 0) {
    html = '<div class="gap"><h3>Nothing matches that.</h3><p>Try a neighborhood like Flushing or Corona.</p></div>';
  }

  for (var i = 0; i < shown.length; i++) {
    var p = shown[i];
    html += '<div class="card" data-i="' + i + '">';
    html += "<h3>" + p.name + "</h3>";
    html += "<p>" + p.address + ", " + p.city + " " + p.zip + "</p>";
    if (p.miles != null) html += "<p>" + p.miles.toFixed(1) + " miles away</p>";
    if (!p.speaks) {
      html += '<span class="chip grey">' + p.kind + "</span>";
    } else if (cur.all) {
      html += '<span class="chip">' + p.languages.length +
        (p.languages.length == 1 ? " language" : " languages") + "</span>";
    } else {
      html += '<span class="chip">speaks ' + cur.name + "</span>";
    }
    html += "</div>";
  }

  document.getElementById("list").innerHTML = html;
}


document.getElementById("list").onclick = function (e) {
  var card = e.target.closest(".card");
  if (!card) return;

  var old = document.querySelectorAll(".card.on");
  for (var i = 0; i < old.length; i++) old[i].className = "card";
  card.className = "card on";

  // might be inside a cluster
  var p = pins[card.dataset.i];
  p.group.zoomToShowLayer(p.marker, function () {
    p.marker.openPopup();
  });
};


function popupFor(p) {
  var html = "<h3>" + p.name + "</h3>";
  html += "<p>" + p.kind + "</p>";
  html += "<p>" + p.address + ", " + p.city + " " + p.zip + "</p>";
  if (p.phone) html += '<p><a href="tel:' + p.phone.replace(/\D/g, "") + '">' + p.phone + "</a></p>";
  if (p.website) html += '<p><a href="' + p.website + '" target="_blank">Visit website</a></p>';

  if (p.speaks) {
    html += "<p><b>" + p.languages.join(" · ") + "</b></p>";
  } else {
    html += "<p><b>Languages not reported</b></p>";
  }

  // too long for a popup
  if (p.payment) {
    var parts = p.payment.split("; ");
    html += "<p>Payment: " + parts.slice(0, 3).join(", ");
    if (parts.length > 3) html += ", and more";
    html += "</p>";
  }
  return html;
}


function findMe() {
  document.getElementById("loc").innerText = "Finding you...";
  navigator.geolocation.getCurrentPosition(function (pos) {
    my_loc = [pos.coords.latitude, pos.coords.longitude];
    L.circleMarker(my_loc, { radius: 7, color: "#1a73e8", fillOpacity: 1 })
      .addTo(map).bindPopup("You are here");
    document.getElementById("loc").innerText = "Sorted by distance from you";
    update();
  }, function () {
    document.getElementById("loc").innerText = "Could not get your location";
  });
}
