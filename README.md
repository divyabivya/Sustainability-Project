# Machine Learning Applications for Wetland Decline Monitoring

Datasets Used in this Project:

https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003 Elevation Dataset
https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED Sentinel-2 Dataset
https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MCD12Q1?hl=en#bands MODIS Land Cover Dataset
https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC09_C02_T1_TOA#bands Landsat 9 Dataset

This project was built entirely on the platform Google Earth Engine, in Javascript. 

MODIS Land Cover Dataset was used as a reference when creating wetland, water, and urban datapoints. The datasets were then merged and randomized. Each class was assigned a value. 0 = Wetland, 1 = Water, 2 = Urban. Over 600 datapoints were created to ensure generalizability for the model. 

Region With Data and Region without Data contain the coordinates for the regions I focused on within my project. 

Urban, Water, and Wetland files contain the point coordinates for my data categorized by category.

CreatingTestingTraining Datasets is the code I used in creating, randomizing, and splitting my data in testing and training datasets.

Landsat 9 file contains the code used to analyze the machine learning model's performance with Landsat 9 Imagery.

App File (Sentinel-2) contains the code for my final project, analyzing and displaying Sentinel-2 Imagery in the spring. 


