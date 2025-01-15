// importing the MODIS Land Cover dataset which will create the training and testing data
//the MODIS dataset has wetlands + water categorized on land
var modisLandCoverDataset = ee.ImageCollection('MODIS/061/MCD12Q1')
 .filterDate('2021-01-01', '2021-12-31')// filtering it to the year 2021
 .filterBounds(Region)//filtering it to our region of interest
 .select('LC_Prop3'); //selecting the category which we will use


 modisLandCoverDataset = modisLandCoverDataset.median(); 
 //taking the median image so that there is less noise 
 

 //cloud masking function using SCL
function maskCloudAndShadows(image) {
  //selecting scl band 
  var scl = image.select('SCL');
  
  //filtering for only these things
  var mask = scl.eq(4) //vegetation
              .or(scl.eq(5)) //bare soils
              .or(scl.eq(6)); //or water
  
  return image.updateMask(mask); //applying the mask
}


// importing the Sentinel-2 dataset 
//this will be the satellite images which the model is given to identify wetlands from
var sentinel2SRCollection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate('2021-01-01', '2021-12-31') //filtering to the year 2021
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)) //filtering for low cloud coverage (<10%)
    .map(maskCloudAndShadows); //applying SCL masking 
    

var medianSentinel2Image = sentinel2SRCollection.filterBounds(Region);//filtering it to our region of interest
medianSentinel2Image = medianSentinel2Image.median();
// calculating median of Sentinel-2 imagery to reduce noise + get best image



// importing elevation dataset
var elevationDataset = ee.Image('USGS/SRTMGL1_003');


//normalizing elevation dataset process
var elevationStats = elevationDataset.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: Region, 
  scale: 30,
  bestEffort: true
});

// extract min and max values as ee.Number
var elevationMin = ee.Number(elevationStats.get('elevation_min'));
var elevationMax = ee.Number(elevationStats.get('elevation_max'));

// normalizing the elevation using an expression 
var elevationNormalized = elevationDataset.expression(
  '((elevation - elevation_min) / (elevation_max - elevation_min))', {
    'elevation': elevationDataset,
    'elevation_min': elevationMin,
    'elevation_max': elevationMax
  }
).rename('elevation_normalized');
//adding a palette for the elevation map
var vizParams = {
  min: 0,
  max: 1,
  palette: ['white', 'gray']
};
//adding a layer for elevation
Map.addLayer(elevationNormalized, vizParams,'Normal. Elevation [white, gray]'
);



//adding a layer which shows all water mapped 
var liquid = modisLandCoverDataset
.updateMask(modisLandCoverDataset.eq(3)) //checking for pixels with a value of 3(value of water)
.selfMask(); //making all pixels transparent who didn't have a value of 3
Map.addLayer(liquid, {
  palette: ['blue'],
  max: 255},
  'Water Map [blue]'
);

//adding a layer which shows all wetlands mapped 
var wetlands = modisLandCoverDataset
  .updateMask(modisLandCoverDataset.eq(27).or(modisLandCoverDataset.eq(50))) //two types of wetlands in LCPROP3!
  .selfMask(); // masking everything that is not wetlands
//adding a map of wetlands 
Map.addLayer(wetlands, {
  palette: ['red', 'black'], 
  min: 0,
  max: 50
}, 'Wetlands Map [black + red] ');

//creating a texture category which will help our model recognize wetlands
var texture = medianSentinel2Image.select('B8').reduceNeighborhood({
  reducer: ee.Reducer.stdDev(),
  kernel: ee.Kernel.square(25)  //25 is the most optimal number //tried and tested!
}).rename('Texture');


// computing ndvi of our image -> helps model identify wetlands
var ndvi = medianSentinel2Image.normalizedDifference(['B8', 'B4']).rename('NDVI');

//computing ndwi of our image -> helps model identify wetlands
var ndwi = medianSentinel2Image.normalizedDifference(['B3', 'B8']).rename('NDWI');



//computing ndmi of our image -> helps model identify wetlands
var ndmi = medianSentinel2Image.normalizedDifference(['B8', 'B11']).rename('NDMI');//try  b12 REPLACE WITH 11 original



// combining water, urban, and wetland points created for training data
var combinedTrainingPoints = water.merge(urban).merge(wetland);


var datasetWithRandom = combinedTrainingPoints.randomColumn(); //randomizing our values 

var trainingSet = datasetWithRandom.filter(ee.Filter.lt('random', 0.8)); //this is our training data set
var testingSet = datasetWithRandom.filter(ee.Filter.gte('random', 0.8));//this is our testing data set, 20% is testing!
//80 percent -> training
//20 percent -> testing


// combine all the necessary bands (original bands and computed ones) into the image our model will classify
var combinedImage = medianSentinel2Image
  .select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12'])
  .addBands([ndvi, elevationNormalized, ndwi, ndmi, texture]);
  


var trainingDataset = combinedImage.sampleRegions({ //sampling the training values from the image
    collection: trainingSet,
    scale: 30,
    geometries: true
});
var testingDataset = combinedImage.sampleRegions({ // sampling the pixel values from the image
  collection: testingSet, 
  scale: 30,
  geometries: true
});
//sampleRegions returns a list of properties for each point in the data, such as its texture, amount of red, etc!


var filteredTrainingDataset = trainingDataset.filter(
  ee.Filter.notNull(['B4'])
);
var filteredTestingDataset = testingDataset.filter(
  ee.Filter.notNull(['B4'])
);
//making sure our datasets have values for the B4 Band




// creating a classifier for land cover classification
//random forest is the best option because of its ability to handle large datasets with numerous features
var landCoverClassifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 900, // 900 is the most optimal! tried and testing
  variablesPerSplit: 5 

});


landCoverClassifier = landCoverClassifier.train({ //training our classifier using the training data
   features: filteredTrainingDataset,
  classProperty: 'class', // replacing with property i assigned training data with
    inputProperties: ['B2', 'B11', 'B4', 'B12','NDWI','NDVI', 'elevation_normalized', 'Texture', 'NDMI'] 
  //these are the properties our classifier will use to determine which land category the pixel is

});


// classifying the image with data points, using the trained classifier
var classifiedImage = combinedImage.classify(landCoverClassifier);

var wetlandsClassified = classifiedImage.eq(0).selfMask(); 
//if pixel is equal to 0 -> wetland class, it will set that pixel value to 1, and the other pixels to 0!
//then the self mask will make all pixels with the value of 0 transparent
Map.addLayer(wetlandsClassified, {palette: 'orange'}, 'Predicted Wetlands');
//visualizing the wetlands that the model predicted on the map



var testingResults = filteredTestingDataset.classify(landCoverClassifier);
//testing our model


// generating a confusion matrix
var confusionMatrix = testingResults.errorMatrix('class', 'classification');
print('Confusion Matrix:', confusionMatrix);



//calculate overall accuracy
var overallAccuracy = confusionMatrix.accuracy();
//print('Overall Accuracy:', overallAccuracy); //achieved overall accuracy of 93.9 percent
//print('Class Distribution:', trainingDataset.aggregate_histogram('class'));
//printing the number of wetland, urban and water points to ensure diversity

print('Precision:', confusionMatrix.consumersAccuracy()); //percentage of ml model's predictions correct
print('Recall:', confusionMatrix.producersAccuracy()); //out of all the pixels, how many did ml model classify correctly?



//creating a satellite image for our model to classify without any training data on it
var testerimg = sentinel2SRCollection.filterBounds(Tester); 
testerimg = testerimg.median();
//creating the satellite image
//filtering to the region of interest
//taking the median image to reduce the noise and get the best image

//normalizing elevation dataset process
elevationStats = elevationDataset.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: Tester, 
  scale: 30,
  bestEffort: true
});

// extracting min and max values as ee.Number
elevationMin = ee.Number(elevationStats.get('elevation_min'));
elevationMax = ee.Number(elevationStats.get('elevation_max'));

// normalizing the elevation using an expression 
elevationNormalized = elevationDataset.expression(
  '((elevation - elevation_min) / (elevation_max - elevation_min))', {
    'elevation': elevationDataset,
    'elevation_min': elevationMin,
    'elevation_max': elevationMax
  }
).rename('elevation_normalized');

//creating a texture map of our new region of interest to help our model 
texture = testerimg.select('B8').reduceNeighborhood({
  reducer: ee.Reducer.stdDev(),
  kernel: ee.Kernel.square(25)  //25 is the most optimal number //tried and tested!
}).rename('Texture');


// computing ndvi of our image 
ndvi = testerimg.normalizedDifference(['B8', 'B4']).rename('NDVI');

//computing ndwi of our image 
ndwi = testerimg.normalizedDifference(['B3', 'B8']).rename('NDWI');



//computing ndmi of our image
ndmi = testerimg.normalizedDifference(['B8', 'B11']).rename('NDMI');

combinedImage = testerimg
  .select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12'])
  .addBands([ndvi, elevationNormalized, ndwi, ndmi, texture]); 
  //adding the bands to our image needed by the model
  
classifiedImage = combinedImage.classify(landCoverClassifier);
//classifying the image using our classifying model

wetlandsClassified = classifiedImage.eq(0).selfMask(); 
//if image is equal to 0 -> wetland class, it will set that pixel = to 1, and the others to 0!
//then the self mask will make all pixels with the value of 0 transparent
Map.addLayer(wetlandsClassified, {palette: 'orange'}, 'Wetlands Predicted, no training data');

// adding a title and some explanatory text to a side panel.
var header = ui.Label('Wetland Identification using Machine Learning', {fontSize: '36px', color: 'green'});
var text = ui.Label(
    'Toggle the layers to see how my model predicted wetlands. It may take a minute to load!\n The two orange colored layers are wetland areas my model predicted!',
    {fontSize: '13px', color: 'blue'});
    
        
var text2 = ui.Label(
  'The points on the map you see are the data I used to train my model! \n Green represents wetlands, Blue represents water, and Gray represents urban.',
  {fontSize: '13px', color: 'blue'});
    
var text3 = ui.Label(
  ' I used supervised classification on my data points to train my model. The accuracy in classifying wetland pixels was around 92% accurate!',
  {fontSize: '13px', color: 'blue'});
  

var toolPanel = ui.Panel([header, text, text2, text3], 'flow', {width: '300px'});
ui.root.widgets().add(toolPanel);


