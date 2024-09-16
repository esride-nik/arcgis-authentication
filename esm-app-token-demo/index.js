/**
 * ArcGIS API for JavaScript demo app using application credentials and a server component.
 * This app fills the `appDiv` element in index.html with the map app that searches the map for places
 * and then finds the 3 closest places to the location clicked on the map.
 */
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import Search from "@arcgis/core/widgets/Search";
import Axios from "axios";

let tokenExpiration = null;
let lastGoodToken = null;

// const featureLayerURL = "https://vsaz0204.esri-de.com/server/rest/services/Hosted/gebaeude_shp/FeatureServer"; // org => "User does not have permissions to access 'hosted/gebaeude_shp.mapserver'."
// const featureLayerURL = "https://vsaz0204.esri-de.com/server/rest/services/Hosted/TestNik/FeatureServer"; // group => "User does not have permissions to access 'hosted/testnik.mapserver'."
const featureLayerURL = "https://vsaz0204.esri-de.com/server/rest/services/Hosted/Lades%C3%A4ulen_pro_BL___Kr/FeatureServer/0"; // meiner
const appTokenURL = "http://localhost:3080/auth"; // The URL of the token server

// Line symbol to use to display the route
const routeSymbol = {
    type: "simple-line",
    color: [50, 150, 255, 0.75],
    width: "5",
};

/**
 * Create the map and map view once we get the authentication.
 */
function setupMapView() {

    const map = new Map({
        basemap: "topo-vector"
    });

    const mapView = new MapView({
        map,
        container: "appDiv"
    });

    const searchWidget = new Search({
        view: mapView
      });

    mapView.when(async () => {
        console.log('mapView loaded');
        mapView.ui.add(searchWidget, "top-right");

        // If you set featureLayerURL to a URL to a private feature service you own, you can show those features on the map.
        if (featureLayerURL != null && featureLayerURL != "") {
            const layer = new FeatureLayer({
                url: featureLayerURL
            });
            map.add(layer);

            const q = layer.createQuery()
            q.where = "1=1"

            // queryExtent() automatically adds portal token
            const fullExtent = await layer.queryExtent(q)
            console.log('fullExtent', fullExtent.extent)
            await mapView.goTo(fullExtent.extent)
              .catch((error) => {
                if (error.name != "AbortError") {
                   console.error(error);
                }
              });
        }
    })
}

/**
 * Wait for a token. If we previously asked for a token and it has not expired then return
 * the locally cached token. Otherwise contact the token server and ask it for a token.
 * @returns {Promise} A Promise that resolves with a token.
 */
function requestApplicationToken() {
    return new Promise(function (resolve, reject) {
        // if we still have a good token then use it
        if (tokenExpiration != null && Date.now() < tokenExpiration) {
            resolve(lastGoodToken);
            return;
        }
        // Send a request to our authentication endpoint
        let session_id = 1234; // @TODO the same server should assign a session id to each session request.
        Axios.post(appTokenURL, {
            nonce: session_id
        })
        .then(function(response) {
            const responseData = response.data;
            if (typeof responseData.error != "undefined") {
                // Errors come back with status 200 so we need to swizzle the real error code from the response body.
                const error = new Error(responseData.error.message);
                error.code = responseData.error.code;
                reject(error);
            } else {
                // remember the token and when it expires
                lastGoodToken = responseData;
                tokenExpiration = new Date(Date.now() + (responseData.expires_in * 1000));
                IdentityManager.registerToken({
                    expires: responseData.expires_in,
                    server: responseData.appTokenBaseURL,
                    ssl: true,
                    token: responseData.access_token,
                    userId: responseData.arcgisUserId
                });
                console.log(lastGoodToken);
                resolve(lastGoodToken);
            }
        })
        .catch(function(error) {
            reject(error);
        });
    });
};

/**
 * When we receive an error, replace the map with the error details.
 * @param {object} error The error received from a failed API call.
 */
function showErrorMessage(error) {
    const app = document.getElementById("appDiv");
    if (app) {
        app.innerHTML = "<h3>Cannot create map view</h3><p>Received error from the auth service:</p><p>" + JSON.stringify(error) + "</p>";
    }
};

// Get a token and render the map
requestApplicationToken()
.then(function(response) {
    setupMapView();
})
.catch(function(error) {
    showErrorMessage(error);
});
