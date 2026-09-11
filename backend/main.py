import xarray as xr
from pathlib import Path
from functools import lru_cache

from services.netcdf_service import get_dataset_info
from services.argo_service import get_argo_profiles

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

import random


app = FastAPI(title="Ocean Data Visualization API")

BASE_DIR = Path(__file__).resolve().parent.parent

@app.get("/")
def serve_frontend():
    return FileResponse(BASE_DIR / "frontend" / "index.html")


# ==========================================
# MODEL DATASET
# ==========================================

MODEL_FILE = (
    Path(__file__).parent
    / "data"
    / "model"
    / "indian_ocean_large.nc"
)


# ==========================================
# CORS SETTINGS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# HOME API
# ==========================================

@app.get("/")
def home():
    return {
        "message": "Ocean Data API is running successfully"
    }


# ==========================================
# OLD OCEAN DATA API
# ==========================================

@app.get("/ocean-data")
def get_ocean_data():

    ocean_data = []

    ocean_regions = [

        {
            "name": "Indian Ocean",
            "lat_min": -50,
            "lat_max": 30,
            "lon_min": 20,
            "lon_max": 120
        },

        {
            "name": "Pacific Ocean",
            "lat_min": -60,
            "lat_max": 60,
            "lon_min": 120,
            "lon_max": 180
        },

        {
            "name": "Pacific Ocean - East",
            "lat_min": -60,
            "lat_max": 60,
            "lon_min": -180,
            "lon_max": -70
        },

        {
            "name": "Atlantic Ocean",
            "lat_min": -60,
            "lat_max": 70,
            "lon_min": -70,
            "lon_max": 20
        },

        {
            "name": "Southern Ocean",
            "lat_min": -75,
            "lat_max": -50,
            "lon_min": -180,
            "lon_max": 180
        },

        {
            "name": "Arctic Ocean",
            "lat_min": 70,
            "lat_max": 85,
            "lon_min": -180,
            "lon_max": 180
        }
    ]

    for i in range(500):

        region = random.choice(ocean_regions)

        latitude = round(
            random.uniform(
                region["lat_min"],
                region["lat_max"]
            ),
            2
        )

        longitude = round(
            random.uniform(
                region["lon_min"],
                region["lon_max"]
            ),
            2
        )

        depth = round(
            random.uniform(0, 5500),
            2
        )

        latitude_factor = abs(latitude) / 90

        surface_temperature = (
            30 - (latitude_factor * 28)
        )

        depth_factor = depth / 5500

        temperature = (
            surface_temperature
            - (
                depth_factor
                * random.uniform(2, 12)
            )
        )

        temperature = max(
            -2,
            min(32, temperature)
        )

        temperature = round(
            temperature,
            2
        )

        salinity = random.uniform(
            30,
            37
        )

        if abs(latitude) < 20:
            salinity += random.uniform(
                -1,
                1
            )

        if abs(latitude) > 60:
            salinity -= random.uniform(
                0,
                2
            )

        salinity = max(
            28,
            min(39, salinity)
        )

        salinity = round(
            salinity,
            2
        )

        source = random.choice([
            "Argo Float",
            "Glider",
            "CTD",
            "Model Output"
        ])

        ocean_data.append({

            "id": i + 1,

            "region": region["name"],

            "source": source,

            "latitude": latitude,

            "longitude": longitude,

            "depth": depth,

            "temperature": temperature,

            "salinity": salinity
        })

    return ocean_data


# ==========================================
# NETCDF INFORMATION
# ==========================================

@app.get("/api/netcdf/info")
def netcdf_info():

    if not MODEL_FILE.exists():

        return {
            "status": "no_dataset",
            "message": (
                "Indian Ocean NetCDF file not found: "
                "data/model/indian_ocean_large.nc"
            )
        }

    return {
        "status": "success",
        "file": MODEL_FILE.name,
        "dataset": get_dataset_info(
            str(MODEL_FILE)
        )
    }


# ==========================================
# MODEL DATA
# ==========================================

@app.get("/api/model/data")
@lru_cache(maxsize=128)
def model_data(
    variable: str = "thetao",
    depth: float = 0.5,
    time_index: int = 0,
    max_points: int = 10000
):

    # ==========================================
    # CHECK DATASET
    # ==========================================

    if not MODEL_FILE.exists():

        return {
            "status": "no_dataset",
            "message": (
                "Indian Ocean NetCDF file not found: "
                "data/model/indian_ocean_large.nc"
            )
        }


    # ==========================================
    # OPEN DATASET
    # ==========================================

    ds = xr.open_dataset(
        MODEL_FILE
    )


    # ==========================================
    # CHECK VARIABLE
    # ==========================================

    if variable not in ds.data_vars:

        available_variables = list(
            ds.data_vars
        )

        ds.close()

        return {
            "status": "error",
            "message": (
                f"Variable '{variable}' not found"
            ),
            "available_variables":
                available_variables
        }


    data = ds[variable]


    # ==========================================
    # SELECT TIME
    # ==========================================

    if "time" in data.dims:

        if time_index < 0:
            time_index = 0

        if time_index >= data.sizes["time"]:
            time_index = (
                data.sizes["time"] - 1
            )

        data = data.isel(
            time=time_index
        )


    # ==========================================
    # SELECT DEPTH
    # ==========================================

    selected_depth = None

    if "depth" in data.dims:

        data = data.sel(
            depth=depth,
            method="nearest"
        )

        selected_depth = float(
            data["depth"].values
        )


    # ==========================================
    # GET COORDINATES
    # ==========================================

    latitudes = data.latitude.values

    longitudes = data.longitude.values


    total_points = (
        len(latitudes)
        * len(longitudes)
    )


    # ==========================================
    # CALCULATE SAMPLING STRIDE
    # ==========================================

    if max_points < 1000:
        max_points = 1000

    if max_points > 30000:
        max_points = 30000

    stride = max(
        1,
        int(
            (total_points / max_points) ** 0.5
        )
    )


    # ==========================================
    # SUBSAMPLE BEFORE LOADING DATA
    # ==========================================

    sampled_data = data.isel(

        latitude=slice(
            0,
            None,
            stride
        ),

        longitude=slice(
            0,
            None,
            stride
        )
    )


    sampled_latitudes = (
        sampled_data.latitude.values
    )

    sampled_longitudes = (
        sampled_data.longitude.values
    )


    # ==========================================
    # LOAD ONLY SUBSAMPLED VALUES
    # ==========================================

    values = sampled_data.values


    # ==========================================
    # CREATE POINTS
    # ==========================================

    points = []


    for i, lat in enumerate(
        sampled_latitudes
    ):

        for j, lon in enumerate(
            sampled_longitudes
        ):

            try:

                value = float(
                    values[i, j]
                )

                if value == value:

                    points.append({

                        "latitude":
                            float(lat),

                        "longitude":
                            float(lon),

                        "value":
                            value
                    })

            except (
                TypeError,
                ValueError,
                IndexError
            ):

                continue


    # ==========================================
    # TIME
    # ==========================================

    selected_time = None

    if "time" in ds.coords:

        selected_time = str(
            ds["time"]
            .isel(time=time_index)
            .values
        )


    # ==========================================
    # CLOSE DATASET
    # ==========================================

    ds.close()


    # ==========================================
    # RESPONSE
    # ==========================================

    return {

        "status": "success",

        "variable": variable,

        "depth_requested":
            depth,

        "depth_selected":
            selected_depth,

        "time_index":
            time_index,

        "time":
            selected_time,

        "original_point_count":
            total_points,

        "point_count":
            len(points),

        "sampling_stride":
            stride,

        "points":
            points
    }


# ==========================================
# MODEL DEPTHS
# ==========================================

@app.get("/api/model/depths")
@lru_cache(maxsize=1)
def model_depths():

    if not MODEL_FILE.exists():

        return {
            "status": "no_dataset",
            "message": (
                "Indian Ocean NetCDF file not found: "
                "data/model/indian_ocean_large.nc"
            )
        }


    ds = xr.open_dataset(
        MODEL_FILE
    )


    depths = [
        float(depth)
        for depth in ds["depth"].values
    ]


    ds.close()


    return {

        "status": "success",

        "count":
            len(depths),

        "depths":
            depths
    }


# ==========================================
# MODEL VARIABLES
# ==========================================

@app.get("/api/model/variables")
@lru_cache(maxsize=1)
def model_variables():

    if not MODEL_FILE.exists():

        return {
            "status": "no_dataset",
            "message": (
                "Indian Ocean NetCDF file not found: "
                "data/model/indian_ocean_large.nc"
            )
        }


    ds = xr.open_dataset(
        MODEL_FILE
    )


    variable_info = {}


    for name in ds.data_vars:

        variable_info[name] = {

            "long_name": str(
                ds[name].attrs.get(
                    "long_name",
                    name
                )
            ),

            "units": str(
                ds[name].attrs.get(
                    "units",
                    ""
                )
            )
        }


    ds.close()


    return {

        "status": "success",

        "variables":
            variable_info
    }


# ==========================================
# MODEL TIMES
# ==========================================

@app.get("/api/model/times")
@lru_cache(maxsize=1)
def model_times():

    if not MODEL_FILE.exists():

        return {
            "status": "no_dataset",
            "message": (
                "Indian Ocean NetCDF file not found: "
                "data/model/indian_ocean_large.nc"
            )
        }


    ds = xr.open_dataset(
        MODEL_FILE
    )


    if "time" not in ds.coords:

        ds.close()

        return {

            "status": "error",

            "message":
                "Dataset does not contain "
                "a time coordinate"
        }


    times = [
        str(time)
        for time in ds["time"].values
    ]


    ds.close()


    return {

        "status": "success",

        "count":
            len(times),

        "times":
            times
    }


# ==========================================
# ARGO DATA
# ==========================================

@app.get("/api/argo/data")
def get_argo_data():

    try:

        profiles = get_argo_profiles()

        summary = []


        for profile in profiles:

            summary.append({

                "profile_index":
                    profile[
                        "profile_index"
                    ],

                "latitude":
                    profile[
                        "latitude"
                    ],

                "longitude":
                    profile[
                        "longitude"
                    ],

                "time":
                    profile[
                        "time"
                    ]
            })


        return {

            "status": "success",

            "count":
                len(summary),

            "profiles":
                summary
        }


    except Exception as e:

        return {

            "status": "error",

            "message":
                str(e)
        }


# ==========================================
# SINGLE ARGO PROFILE
# ==========================================

@app.get(
    "/api/argo/profile/{profile_index}"
)
def argo_profile(
    profile_index: int
):

    from services.argo_service import (
        get_argo_profile
    )


    profile = get_argo_profile(
        profile_index
    )


    if profile is None:

        return {

            "status": "error",

            "message":
                "Argo profile not found"
        }


    return {

        "status": "success",

        "profile":
            profile
    }
app.mount(
    "/",
    StaticFiles(directory=BASE_DIR / "frontend", html=True),
    name="frontend"
)
