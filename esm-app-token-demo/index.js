/**
 * ArcGIS API for JavaScript demo app using application credentials and a server component.
 * This app fills the `appDiv` element in index.html with the map app that searches the map for places
 * and then finds the 3 closest places to the location clicked on the map.
 */
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import * as route from "@arcgis/core/rest/route";
import RouteParameters from "@arcgis/core/rest/support/RouteParameters";
import FeatureSet from "@arcgis/core/rest/support/FeatureSet";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import StreamLayer from "@arcgis/core/layers/StreamLayer";
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import Search from "@arcgis/core/widgets/Search";
import Axios from "axios";

let tokenExpiration = null;
let lastGoodToken = null;

const demoDestination = new Point([-116.3697003, 33.7062298]);
const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

// ArcGIS Enterprise
// const featureLayerURL = "https://vsaz0116.esri-de.com/server/rest/services/Hosted/JustALine/FeatureServer/0" // AstronautNik
const featureLayerURL = "https://vsaz0116.esri-de.com/server/rest/services/Hosted/JustALine_pa/FeatureServer"    // portaladmin

// StreamLayer
const streamLayerURL_s = "https://vsaz0116.esri-de.com/server/rest/services/ISS-position-secured/StreamServer"; // secured portaladmin
const streamLayerURL_p = "https://vsaz0116.esri-de.com/server/rest/services/ISS-position-unsecured/StreamServer"; // public

// const appTokenURL = "http://localhost:3080/auth"; // The URL of the token server
const appTokenURL = "https://localhost:3001/auth"; // The URL of the token server

// Line symbol to use to display the route
const routeSymbol = {
    type: "simple-line",
    color: [50, 150, 255, 0.75],
    width: "5",
};

/**
 * Display a simple marker symbol on the MapView.
 * @param {string} type The type of point to show, either "start" or "end".
 * @param {Point} point The geographic point to place the marker symbol.
 * @param {MapView} view The mapView to use to display route graphics.
 */
function addGraphic(type, point, view) {
    const graphic = new Graphic({
      symbol: {
        type: "simple-marker",
        color: (type === "start") ? "green" : "red",
        size: "12px",
        outline: {
            color: "black",
            width: "2px",
        }
      },
      geometry: point
    });
    view.graphics.add(graphic);
}

const addStreamLayer = (mapView, streamLayerUrl) => {
    // ISS layer
    const issSymbol = {
      angle: 0,
      xoffset: 0,
      yoffset: 0,
      type: "picture-marker",
      url: "data:image/png;base64," + "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",
      contentType: "image/png",
      width: 30,
      height: 22.439024390243905
    };
    let issRenderer = {
        type: "simple",
        symbol: issSymbol,
      };

    // Construct Stream Layer
    const streamLayer = new StreamLayer({
        url: streamLayerUrl,
        purgeOptions: {
        displayCount: 10000
        },
        maxReconnectionAttempts: 100,
        maxReconnectionInterval: 10,
        renderer: issRenderer,
        popupEnabled: true
    })
    mapView.map.add(streamLayer);

    mapView.whenLayerView(streamLayer)
        .then((lv) => {
            const pt = streamLayer.createPopupTemplate();
            console.log('slpt', pt);
            streamLayer.popupTemplate = pt;
        })
}

/**
 * Create the map and map view once we get the authentication.
 */
function setupMapView() {

    const map = new Map({
        basemap: "satellite"
    });

    const mapView = new MapView({
        map,
        container: "appDiv",
        popupEnabled: true
    });

    const searchWidget = new Search({
        view: mapView
      });

    mapView.when(async () => {
        console.log('mapView loaded');
        mapView.ui.add(searchWidget, "top-right");

        // token does not work on secured StreamLayer
        addStreamLayer(mapView, streamLayerURL_s);

        // unsecured StreamLayer is fine
        // addStreamLayer(mapView, streamLayerURL_p);

        // // If you set featureLayerURL to a URL to a private feature service you own, you can show those features on the map.
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

            // queryFeatures() automatically adds portal token
            q.num = 1
            const destination = await layer.queryFeatures(q)
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
                // TODO: only seems to work with AGE tokens (someone else had the same issue: https://github.com/Esri/developer-support/issues/341#issuecomment-670398992). when using AGO token, JSSDK doesn't add a token param to service requests
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
