import xarray as xr


def load_netcdf(path: str):
    """
    Open a NetCDF dataset using xarray.
    """
    return xr.open_dataset(path)


def get_dataset_info(path: str):
    """
    Return useful metadata about a NetCDF dataset.
    """

    dataset = xr.open_dataset(path)

    return {
        "dimensions": {
            name: int(size)
            for name, size in dataset.sizes.items()
        },
        "variables": list(dataset.data_vars),
        "coordinates": list(dataset.coords),
        "attributes": {
            str(key): str(value)
            for key, value in dataset.attrs.items()
        }
    }