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
const featureLayerURL = "https://vsaz0116.esri-de.com/server/rest/services/Hosted/JustALine/FeatureServer/0"

// StreamLayer
const streamLayerURL_s = "https://vsaz0116.esri-de.com/server/rest/services/ISS-position-secured/StreamServer"; // secured
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

/**
 * Show the route given the start and end locations.
 * @param {MapView} view The mapView to use to display route graphics.
 */
const getRoute = (view) => {

    const routeParams = new RouteParameters({
      stops: new FeatureSet({
        features: view.graphics.toArray()
      }),
      returnDirections: true
    });

    const showRoutes = (routes) => {
        routes.forEach((result) => {
          result.route.symbol = routeSymbol;
          view.graphics.add(result.route,0);
        });
    }

    const showDirections = (directions) => {
        function showRouteDirections(directions) {
            const directionsList = document.createElement("ol");
            directions.forEach((result,i) => {
                const direction = document.createElement("li");
                direction.innerHTML = result.attributes.text + ((result.attributes.length > 0) ? " (" + result.attributes.length.toFixed(2) + " miles)" : "");
                directionsList.appendChild(direction);
            });
            directionsElement.appendChild(directionsList);
        }

        const directionsElement = document.createElement("div");
        directionsElement.innerHTML = "<h3>Directions</h3>";
        directionsElement.classList = "esri-widget esri-widget--panel esri-directions__scroller directions";
        directionsElement.style.marginTop = "0";
        directionsElement.style.padding = "0 15px";
        directionsElement.style.minHeight = "365px";

        showRouteDirections(directions);

        view.ui.empty("top-right");
        view.ui.add(directionsElement, "top-right");
    }

    // TODO: route.solve() doesn't automatically add portal token :(
    // route.solve(`${routeUrl}?token=${lastGoodToken.access_token}`, routeParams) // => error "Invalid token", although portal token is okay and AGO service added to org as utility service
    route.solve(routeUrl, routeParams)
      .then((response) => {
        showRoutes(response.routeResults)
        showDirections(response.routeResults[0].directions.features);
      })
      .catch((error) => {
        console.log(error);
      });
}

const addStreamLayer = (mapView, streamLayerUrl) => {
    let issRenderer = {
        type: "simple",
        symbol: {
          type: "simple-marker",
          size: 6,
          color: "black",
          outline: {
            width: 0.5,
            color: "white"
          }
        }
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

        addStreamLayer(mapView, streamLayerURL_s);
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

            // create a demo route once the view is loaded (with FL)
            addGraphic("start", fullExtent.extent.center, mapView);

            // queryFeatures() automatically adds portal token
            q.num = 1
            const destination = await layer.queryFeatures(q)
            addGraphic("finish", destination?.features[0].geometry ?? demoDestination, mapView);
            getRoute(mapView);
        }
        else {
            // create a demo route once the view is loaded (without FL)
            addGraphic("start", mapView.center, mapView);
            setTimeout(() => {
                addGraphic("finish", demoDestination, mapView);
                getRoute(mapView);
            }, 1000);
        }
    })

    mapView.on("click", (event) => {
        // when the map is clicked on, start or complete a new route
        if (mapView.graphics.length === 0) {
            // start a route when there is no prior start point
            addGraphic("start", event.mapPoint, mapView);
          } else if (mapView.graphics.length === 1) {
            // complete the route from the prior start point to this new point
            addGraphic("finish", event.mapPoint, mapView);
            getRoute(mapView);
          } else {
            // remote prior route and start a new route
            mapView.graphics.removeAll();
            mapView.ui.empty("top-right");
            addGraphic("start", event.mapPoint, mapView);
          }
    });
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
