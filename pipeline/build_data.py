# makes the data for the map

import json
import requests

FIND = "https://findtreatment.gov/locator/exportsAsJson/v2"
NYC = "https://data.cityofnewyork.us/resource/"

# 110xx and 114xx are also nassau and brooklyn
qns_zips = ("11004 11005 11101 11102 11103 11104 11105 11106 11109 11351 11354 "
            "11355 11356 11357 11358 11359 11360 11361 11362 11363 11364 11365 "
            "11366 11367 11368 11369 11370 11372 11373 11374 11375 11377 11378 "
            "11379 11385 11411 11412 11413 11414 11415 11416 11417 11418 11419 "
            "11420 11421 11422 11423 11426 11427 11428 11429 11430 11432 11433 "
            "11434 11435 11436 11691 11692 11693 11694 11695 11697").split()

langs = {
    "American Sign Language": ("ASL", "ase"),
    "Arabic": ("العربية", "ar"),
    "Chinese": ("中文", "zh"),
    "English": ("English", "en"),
    "French": ("Français", "fr"),
    "German": ("Deutsch", "de"),
    "Greek": ("Ελληνικά", "el"),
    "Haitian Creole": ("Kreyòl Ayisyen", "ht"),
    "Hebrew": ("עברית", "he"),
    "Hindi": ("हिन्दी", "hi"),
    "Italian": ("Italiano", "it"),
    "Japanese": ("日本語", "ja"),
    "Korean": ("한국어", "ko"),
    "Persian (Farsi)": ("فارسی", "fa"),
    "Polish": ("Polski", "pl"),
    "Portuguese": ("Português", "pt"),
    "Russian": ("Русский", "ru"),
    "Spanish": ("Español", "es"),
    "Tagalog (Filipino)": ("Tagalog", "tl"),
}

# what samhsa calls them vs what people call them
same = {
    "Any Chinese Language": "Chinese",
    "Creole": "Haitian Creole",
    "Farsi": "Persian (Farsi)",
    "Tagalog": "Tagalog (Filipino)",
    "Sign language services for the deaf and hard of hearing": "American Sign Language",
}


def lang_list(services):
    # languages live in the SL and OL blocks
    out = ["English"]
    for b in services:
        if b["f2"] == "SL" or b["f2"] == "OL":
            for item in b["f3"].split("; "):
                # a flag, not a language
                if item == "Other languages (excluding Spanish)":
                    continue
                item = same.get(item, item)
                if item not in out:
                    out.append(item)
    out.sort()
    return out


def get_clinics():
    # no borough filter, so page outward until we leave queens
    found = {}
    for page in range(1, 10):
        p = {"sAddr": "40.7282,-73.7949", "sType": "BOTH", "limitType": 3,
             "limitValue": 2000, "pageSize": 100, "page": page, "sort": 0}
        rows = requests.get(FIND, params=p, timeout=90).json()["rows"]
        if len(rows) == 0:
            break

        for r in rows:
            if r["state"] != "NY" or r["zip"][:5] not in qns_zips:
                continue

            name = r["name1"]
            if r["name2"]:
                name += " " + r["name2"]
            addr = r["street1"]
            if r["street2"]:
                addr += " " + r["street2"]
            kind = "mental health" if r["typeFacility"] == "MH" else "substance use"

            # listed twice under mental health and substance use, merge them
            key = (name + addr).lower()
            if key in found:
                old = found[key]
                for lg in lang_list(r["services"]):
                    if lg not in old["languages"]:
                        old["languages"].append(lg)
                old["languages"].sort()
                if old["kind"] != kind:
                    old["kind"] = "mental health + substance use"
                continue

            pay = ""
            for b in r["services"]:
                if b["f2"] == "PAY":
                    pay = b["f3"]

            found[key] = {
                "name": name,
                "address": addr,
                "city": r["city"],
                "zip": r["zip"][:5],
                "phone": r["phone"] or r["intake1"],
                "website": r["website"],
                "lat": float(r["latitude"]),
                "lon": float(r["longitude"]),
                "kind": kind,
                "payment": pay,
                "languages": lang_list(r["services"]),
            }

        far = max(r["miles"] for r in rows)
        print("page", page, "- out to", far, "miles")
        if far > 18:
            break

    return list(found.values())


def get_community():
    # these dont report languages
    kinds = {"PUBLIC LIBRARIES": "library",
             "IMMIGRANT SERVICES": "immigrant services",
             "ADULT AND IMMIGRANT LITERACY": "literacy / ESOL",
             "LEGAL AND INTERVENTION SERVICES": "legal help"}

    where = "boro='QUEENS' AND latitude IS NOT NULL AND facsubgrp IN ("
    where += ",".join("'" + k + "'" for k in kinds) + ")"
    p = {"$select": "facname,address,city,zipcode,latitude,longitude,facsubgrp",
         "$where": where, "$limit": 1000}
    rows = requests.get(NYC + "ji82-xba5.json", params=p, timeout=90).json()

    out = {}
    for r in rows:
        key = (r["facname"] + r["address"]).lower()
        out[key] = {
            # city uses all caps
            "name": r["facname"].title(),
            "address": r["address"].title(),
            "city": r["city"].title(),
            "zip": r["zipcode"],
            "lat": float(r["latitude"]),
            "lon": float(r["longitude"]),
            "kind": kinds[r["facsubgrp"]],
        }
    return list(out.values())


clinics = get_clinics()
print(len(clinics), "clinics in queens")

community = get_community()
print(len(community), "community sites")

# count per language
sites = {}
for c in clinics:
    for lg in c["languages"]:
        sites[lg] = sites.get(lg, 0) + 1

rows = []
for name in sorted(sites):
    native, tag = langs.get(name, (name, "en"))
    rows.append({"name": name, "native": native, "tag": tag, "sites": sites[name]})
    print(" ", sites[name], "clinics -", name)

for name, data in [("services.json", clinics), ("community.json", community),
                   ("languages.json", rows)]:
    f = open("data/" + name, "w", encoding="utf-8")
    json.dump(data, f, indent=1, ensure_ascii=False)
    f.close()
    print("wrote data/" + name)
