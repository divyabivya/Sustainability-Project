# Machine Learning Applications for Wetland Decline Monitoring

Datasets Used in this Project:

https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003 Elevation Dataset
https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED Sentinel-2 Dataset
https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MCD12Q1?hl=en#bands MODIS Land Cover Dataset
https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC09_C02_T1_TOA#bands Landsat 9 Dataset

This project was built entirely on the platform Google Earth Engine, in Javascript. 
Training and testing datapoint collection files were created individually. 

MODIS Land Cover Dataset was used as a reference when creating wetland, water, and urban datapoints. The datasets were then merged and randomized. Each class was assigned a value. 0 = Wetland, 1 = Water, 2 = Urban. Over 600 datapoints were created to ensure generalizability for the model. 


