/**
 * Get JSON from a local file
 *
 * @param {string} fileName
 * @returns {object}
 */
function getCachedData(fileName) {
  const fileManager = FileManager.iCloud();
  const cacheDirectory = fileManager.joinPath(fileManager.documentsDirectory(), "bluewalk/mijnsimpel");
  const cacheFile = fileManager.joinPath(cacheDirectory, fileName);

  if (!fileManager.fileExists(cacheFile)) {
    return undefined;
  }

  const contents = fileManager.readString(cacheFile);
  return JSON.parse(contents);
}

/**
 * Wite JSON to a local file
 *
 * @param {string} fileName
 * @param {object} data
 */
function cacheData(fileName, data) {
  const fileManager = FileManager.iCloud();
  const cacheDirectory = fileManager.joinPath(fileManager.documentsDirectory(), "bluewalk/mijnsimpel");
  const cacheFile = fileManager.joinPath(cacheDirectory, fileName);

  if (!fileManager.fileExists(cacheDirectory)) {
    fileManager.createDirectory(cacheDirectory);
  }

  const contents = JSON.stringify(data);
  fileManager.writeString(cacheFile, contents);
}

/**
 * Prompts the user for their username and password.
 *
 * @returns username and password
 */
async function promptForCredentials() {
  let alert = new Alert();
  alert.title = "Login Required";
  alert.message = "Please enter your username and password.";
  alert.addTextField("Username");
  alert.addSecureTextField("Password");
  alert.addAction("OK");
  alert.addCancelAction("Cancel");

  let response = await alert.presentAlert();
  if (response === -1) {
    throw new Error("User cancelled the login prompt.");
  }

  let username = alert.textFieldValue(0);
  let password = alert.textFieldValue(1);

  return { username, password };
}

/**
 * Fetches the token from the API.
 *
 * @param credentials null
 */
async function fetchToken(credentials) {
  const payload = {
    username: credentials.username,
    password: credentials.password,
    remember: true,
    datetime: new Date().toISOString()
  };

  let req = new Request("https://api.simpel.nl/login");
  req.method = "POST";
  req.headers = { "Content-Type": "application/json" };
  req.body = JSON.stringify(payload);

  let response = await req.load();
  if (req.response.statusCode !== 200) {
    throw new Error(`Failed to fetch token: ${req.response.statusCode}`);
  }

  let cookies = req.response.cookies;
  cacheData("cookies.json", cookies);
}

/**
 * Fetches the subscriptionId from the API.
 *
 * @returns subscriptionId
 */
async function fetchSid(cookies) {
  const url = "https://api.simpel.nl/account/subscription-overview";
  let req = new Request(url);
  req.headers = { "Cookie": cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ") };

  let json = await req.loadJSON();

  cacheData("sid.json", json.mainSubscription.subscriptionId);
}

/**
 * Fetches the usage data from the API.
 * 
 * @param sid 
 * @param cookies 
 * @returns 
 */
async function fetchData(sid, cookies) {
  try {
    const url = `https://mijn.simpel.nl/api/usage/usage-summary?sid=${sid}`;
    let req = new Request(url);
    req.headers = { "Cookie": cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ") };

    await req.load();
    
    if (req.response.statusCode === 200) {
      return json = await req.loadJSON()
    } else {
      console.error('Request failed with status:', req.response.statusCode);
      return { errorCode: req.response.statusCode };
    }
  } catch (error) {
    console.error(error);
    return { errorCode: -1 };
  }
}

/**
 * Adds a text element to the stack with the specified text and color.
 *
 * @param stack
 * @param text
 * @param color
 */
function addStackText(stack, text, color) {
  let widgetText = stack.addText(text);
  widgetText.font = Font.boldSystemFont(16);
  widgetText.textColor = color ?? Color.white();
}

/**
 * Adds a usage element to the stack with the specified icon and data.
 *
 * @param stack
 * @param icon
 * @param data
 */
function addUsage(stack, icon, data) {
  addStackText(stack, icon + " " + (data.type === "unlimited" ? "∞" : data.amount + "/" + data.totalAmount));
}

const COLORS = {
  standard: {
    start: new Color("#79248C"),
    end: new Color("#50185c")
  },
  error: {
    start: new Color("#D44646"),
    end: new Color("#822424")
  }
}

/**
 * Main function
 */
async function run() {
  let credentials = getCachedData("credentials.json");
  if (credentials === undefined) {
    credentials = await promptForCredentials();
    cacheData("credentials.json", credentials);
  }

  let cookies = getCachedData("cookies.json");
  if (cookies === undefined) {
    await fetchToken(credentials);
    cookies = getCachedData("cookies.json");
  }

  let sid = getCachedData("sid.json");
  if (sid === undefined) {
    await fetchSid(cookies);
    sid = getCachedData("sid.json");
  }

  let json = undefined;
  let colors = undefined;

  json = await fetchData(sid, cookies);

  // Create the widget
  let widget = new ListWidget();
  widget.setPadding(10, 10, 10, 10);

  let logoBase64 = "iVBORw0KGgoAAAANSUhEUgAAAXsAAAByCAMAAACFmIFFAAAC7lBMVEUAAAD/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////jtXoAAAA+XRSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXF1eX2Bh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";
  let logo = Image.fromData(Data.fromBase64String(logoBase64));
  let logoElement = widget.addImage(logo);

  widget.addSpacer(15);

  let stack = widget.addStack();
  stack.layoutVertically();
  stack.spacing = 5;

  if (json.errorCode === undefined) {
    colors = COLORS.standard;

    addUsage(stack, "📶 ", json.data);
    addUsage(stack, "💬 ", json.sms);
    addUsage(stack, "☎️ ", json.voice);
  }
  else {
    colors = COLORS.error;

    addStackText(stack, `Error loading data (${json.errorCode})`, Color.white());
  }

  widget.addSpacer();

  let lastUpdate = widget.addText("Updated at: " + new Date().toLocaleString());
  lastUpdate.font = Font.systemFont(10);
  lastUpdate.textColor = new Color("#CCCCCC");
  lastUpdate.rightAlignText();

  // Set the gradient background
  let gradient = new LinearGradient();
  gradient.colors = [colors.start, colors.end];
  gradient.locations = [0.0, 1.0];
  widget.backgroundGradient = gradient;

  // Set the update interval
  let refreshDate = new Date();
  refreshDate.setMinutes(refreshDate.getMinutes() + 30);
  widget.refreshAfterDate = refreshDate;

  if (config.runsInApp) {
    widget.presentSmall();
  }

  Script.setWidget(widget);
  Script.complete();
}

await run();