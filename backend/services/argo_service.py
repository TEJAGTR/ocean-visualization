import xarray as xr
import numpy as np


ARGO_FILE = "data/argo/6903091_prof.nc"


def load_argo_dataset():
    """Open the Argo profile NetCDF dataset."""
    return xr.open_dataset(ARGO_FILE)


def get_argo_profiles():
    """
    Return Argo profile metadata and measurements.

    Each profile contains:
    latitude, longitude, date, pressure,
    temperature and salinity.
    """

    ds = load_argo_dataset()

    profiles = []

    latitude = ds["LATITUDE"].values
    longitude = ds["LONGITUDE"].values
    juld = ds["JULD"].values

    pressure = ds["PRES"].values
    temperature = ds["TEMP"].values
    salinity = ds["PSAL"].values

    for i in range(len(latitude)):

        if np.isnan(latitude[i]) or np.isnan(longitude[i]):
            continue

        levels = []

        for j in range(pressure.shape[1]):

            p = pressure[i, j]
            t = temperature[i, j]
            s = salinity[i, j]

            if np.isnan(p):
                continue

            levels.append({
                "pressure": None if np.isnan(p) else float(p),
                "temperature": None if np.isnan(t) else float(t),
                "salinity": None if np.isnan(s) else float(s)
            })

        profiles.append({
            "profile_index": i,
            "latitude": float(latitude[i]),
            "longitude": float(longitude[i]),
            "time": str(juld[i]),
            "levels": levels
        })

    return profiles
def get_argo_profile(profile_index: int):
    """Return one Argo profile by index."""

    profiles = get_argo_profiles()

    for profile in profiles:
        if profile["profile_index"] == profile_index:
            return profile

    return None
def get_argo_profile(profile_index: int):

    ds = load_argo_dataset()

    try:

        if profile_index < 0:
            return None

        if profile_index >= ds.sizes["N_PROF"]:
            return None

        latitude = ds["LATITUDE"].values[profile_index]
        longitude = ds["LONGITUDE"].values[profile_index]
        juld = ds["JULD"].values[profile_index]

        pressure = ds["PRES"].values[profile_index]
        temperature = ds["TEMP"].values[profile_index]
        salinity = ds["PSAL"].values[profile_index]

        levels = []

        for i in range(len(pressure)):

            p = pressure[i]
            t = temperature[i]
            s = salinity[i]

            if np.isnan(p):
                continue

            levels.append({
                "pressure": (
                    None
                    if np.isnan(p)
                    else float(p)
                ),

                "temperature": (
                    None
                    if np.isnan(t)
                    else float(t)
                ),

                "salinity": (
                    None
                    if np.isnan(s)
                    else float(s)
                )
            })

        return {
            "profile_index": profile_index,

            "latitude": float(latitude),

            "longitude": float(longitude),

            "time": str(juld),

            "levels": levels
        }

    finally:

        ds.close()