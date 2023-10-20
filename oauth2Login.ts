/**
 * ArcGIS API for JavaScript demo app with OAuth user login.
 */
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo";
import Credential from "@arcgis/core/identity/Credential";

async function configureApp(clientID: string) {
  const oauthInfo = new OAuthInfo({
    appId: clientID,
    popup: false,
  });
  IdentityManager.registerOAuthInfos([oauthInfo]);

  try {
    const userCredential: Credential = await IdentityManager.checkSignInStatus(
      oauthInfo.portalUrl + "/sharing"
    );
    // once user is logged in => uncomment next line and go!
    // setupMapView();
  } catch (error: any) {
    // @ts-ignore
    document.getElementById("sign-in").addEventListener("click", function () {
      // Redirect to OAuth Sign In page
      IdentityManager.getCredential(oauthInfo.portalUrl + "/sharing");
    });

    // @ts-ignore
    document.getElementById("sign-out").addEventListener("click", function () {
      IdentityManager.destroyCredentials();
      window.location.reload();
    });
  }
}

configureApp("");
