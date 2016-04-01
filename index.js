var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var restify = require('restify');
var builder = require('botbuilder');

var responseReturn ={}; // to be returned to Google Form responses
var myForm={}; // the form from googel form
var index=0; //the index of the item in the form
var nb_items = 0; // the nb of items in the form

// Create bot and add dialogs
var bot = new builder.BotConnectorBot({ appId: 'YourAppId', appSecret: 'YourAppSecret' });

// Setup Restify Server
var server = restify.createServer();
server.post('/api/messages', bot.verifyBotFramework(), bot.listen());
server.listen(process.env.port || 3978, function () {
    console.log('%s listening to %s', server.name, server.url); 
});

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/script-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/forms'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'script-nodejs-quickstart.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Google Apps Script Execution API.
  authorize(JSON.parse(content), callAppsScript);
});


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
	  //console.log(TOKEN_PATH);
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Call an Apps Script function to list the folders in the user's root
 * Drive folder.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function callAppsScript(auth) {
  var scriptId = 'Mny6MsJjcuI5s3x7dzXquEEpkYEklKIS1';
  var script = google.script('v1');

  // Make the API request. The request object is included here as 'resource'.
  script.scripts.run({
    auth: auth,
    resource: {
	  devMode:true,
      function: 'getForm'
    },
    scriptId: scriptId
  }, function(err, resp) {
    if (err) {
      // The API encountered a problem before the script started executing.
      console.log('The API returned an error: ' + err);
      return;
    }
    if (resp.error) {
      // The API executed, but the script returned an error.

      // Extract the first (and only) set of error details. The values of this
      // object are the script's 'errorMessage' and 'errorType', and an array
      // of stack trace elements.
      var error = resp.error.details[0];
      console.log('Script error message: ' + error.errorMessage);
      console.log('Script error stacktrace:');

      if (error.scriptStackTraceElements) {
        // There may not be a stacktrace if the script didn't start executing.
        for (var i = 0; i < error.scriptStackTraceElements.length; i++) {
          var trace = error.scriptStackTraceElements[i];
          console.log('\t%s: %s', trace.function, trace.lineNumber);
        }
      }
    } else {
      // The structure of the result will depend upon what the Apps Script
      // function returns. Here, the function returns an Apps Script Object
      // with String keys and values, and so the result is treated as a
      // Node.js object (folderSet).
      //var items = resp.response.result;
	  myForm = JSON.parse(resp.response.result);
      console.log("######    Got form back from Google    ###### \n");
	  //console.log(JSON.stringify(myForm, null, 4));

	  //get the number of items in my Form
	  nb_items = Object.keys(myForm.items).length;
	  
	  //create the routes for each item of the form
	  for(i=0; i< nb_items; i++){
			bot.add('/'+i, [
				function (session) {
					builder.Prompts.text(session,myForm.items[index].title ); //we ask the question from the current item
					//TODO: ask questions differently depending on the type of the item
				},
				function (session, results) {
					//we store the answers in responseReturn
					responseReturn[index] = results.response; 
					console.log(responseReturn[index]);
					index++;
					//console.log("i = "+i);
					//console.log("index = "+index);
					session.endDialog();
				}
			]);
		}


		bot.add('/', function (session) {
			if (!session.userData.name) {
				session.beginDialog('/profile');
			} else {
				
				if(index < nb_items) //we start prompting the first route corresponding to the first item until there is no more
				{
					session.beginDialog('/'+index);
				}
				else{ // if there is no more items, we end the session and reset the index to 0
					console.log("We are done!");
					console.log(JSON.stringify(responseReturn, null, 4));
					session.send('See ya!');
					index=0;
				}
			}
		})

    }

  });
}