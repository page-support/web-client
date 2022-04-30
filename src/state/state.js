/* Bot state management 
 * Includes
 *   - persisting conversation state in a session
 *   - persisting bot configuration in the browser
 *   - retriving botConfigs from a remote
 */

/******************* Exports *****************/
export { persistent, saveBotState, getBotConfig, versionCompatible };
export { getConversation, saveConversation, deleteConversation };
export { existingConversationBool };

/******************* Imports *****************/
import { writable } from 'svelte/store';




/******************* Constants **********************/

// TODO: URL where botConfig JSON is stored - remote fetch not yet supported.
const REMOTE_CONFIG_URL = 'TBD';

// Having the bot source code check the botConfig version ensures that version
// incompatibilities are surfaced clearly, particularly in cases where the 
// botConfig file is being loaded dynamically from elsewhere.
// The __botConfigVersion__ string is set by rollup to the package.json version
// at build time, hence pkgBotVersion will be set to the package.json bot version.
// If you are using your own build pipeline and want your bot code to check the
// botConfig version replace the RHS value with your version string, or add
// something like https://www.npmjs.com/package/@rollup/plugin-replace
// to your build pipeline to set it. 
// See versionCompatible() function and the README for details.
const pkgBotVersion = '__botConfigVersion__';




/*********************** Functions *******************/


/* getBotConfig() => botConfig instance or null
 * Fetch botConfig from 
 *   1. localStorage, or if empty
 *   2. publisher-maintained remote, then save to localStorage.
 * 
 * Returns instance of botConfig object as defined in BotConfig.js, or error
 * in case remote fetch fails and there's no cache.  Note cache is only
 * used/valid for the duration of one conversation with one Bot. See saveState()
 * for where the botConfig is saved to localStorage.
 * 
 * Returns null and logs error if botConfig acquisition or parsing fails.
 * 
 * Args: 
 *   REQUIRED: getConfigFromRemote is a bool that tells this function whether 
 *   to try to get a config from remote if its not already there. See the 
 *   scenarios described at top of Bot.svelte for usage.
 *   REQUIRED: localStorageKey is a unique per bot string
 * 
 * If not cached, fetch from remote unless this is the beginning of a
 * a new conversation, in which case always fetch from remote. This is
 * needed because user might restart conversation second time e.g. if
 * then forgot the answer or want to take a different path.  Might be
 * significant time between the first (cached) run and the second one.
 */
function getBotConfig(getConfigFromRemote, 
                      localStorageKey) {
  if (getConfigFromRemote === undefined || localStorageKey === undefined ) {
      throw new invalidBotConfig(`getBotConfig() in state.js called with missing argument.  getConfigFromRemote=${getConfigFromRemote}; localStorageKey=${localStorageKey}`);
  }

  let botJSON;
  // newConfig forces getting from remote even if we have one locally
  botJSON = getConfigFromRemote ? fetchBotConfigFromRemote(REMOTE_CONFIG_URL, 
                                                 localStorageKey) :
                                  localStorage.getItem(localStorageKey);                       ;

  if (botJSON) {
      // parse and freeze botJSON since we got something, return
      // Freeze and return botConfig to ensure reusability in new conversation
      const botConfig = Object.freeze(JSON.parse(botJSON));
      if (versionCompatible(botConfig.version)) return botConfig;
  } else {
    throw new invalidBotConfig(`getBotConfig() in state.js failed to acquire a botConfig from localStorage and remote`);
  }
}



export function invalidBotConfig(message) {
	this.name = 'botConfig acquisition error';
  this.message = message;
	this.stack = (new Error()).stack;
}
invalidBotConfig.prototype = new Error;




/* versionCompatible(version: String) => boolean
 * If __botConfigVersion__ is set by rollup, returns
 * true if the version argument is compatible with the bot client code,
 * raises error otherwise. 
 * If __botConfigVersion__ is not set, then also returns true, i.e. there
 * is no version check. So if the version of rollup.config.js in this app
 * is not being used, and version checking is desired, set it manually at 
 * the top of this file, or implement another way to set it when building.
 * "Compatible" means that bot client code can ingest
 * and run the botConfig represented by the version argument. Version argument
 * should be botConfig.version as defined in botConfig.js. This function 
 * compares the version argument's first digit, e.g. the 1 in '1.0.0' with
 * the version in the bot code base's package.json. If it is the same major
 * version then its compatible, otherwise not.  (same as defined by npm in 
 * https://docs.npmjs.com/about-semantic-versioning)
 * 
 * Raises error if version not compatible so can be surfaced in Bot UI. 
 * caller should use try block
 */
function versionCompatible(version) { 
  // if deployer of Bot is using `npm run build` (i.e. its using the   
  // already-built files in dist/) __botConfigVersion__ will
  // be set by rollup. If its not set, the constant botConfigVersion
  // at the top of this file will be used. If your build pipeline doesn't use 
  // npm run build, e.g. if you are building Bot into your own website with
  // your own build pipeline, ensure that botConfigVersion is set to the 
  // same major version as the botConfig files you plan to deploy with the bot.
  if (pkgBotVersion === '__botConfigVersion__') return true;
  if (pkgBotVersion[0] === version[0]) {
    return true;
  } else {
    // versions are incompatible
    throw new invalidBotConfig(
      `Bot source code version ${pkgBotVersion} doesn't match the version of 
the bot configuration file the bot read: ${version}.`);
  }
}
  


/* function existingConversationBool() => boolean
 * Args:
 *  localStorageKey: String
 * 
 * Returns true there is a botConfig AND existing conversation saved to 
 * browser.  False otherwise.
 * Used to show UIthat is dependent on existing conversation in progress. Doesn't test for
 * status of the conversation, so could be at conversation start, end or anywhere 
 * in between. If true, ensures that loading Bot component will result in UI
 * being shown as the dependencies are in place.
 */
function existingConversationBool(localStorageKey) {
  const conversationBool = (getConversation(localStorageKey) ?
    true : false);
  const botConfigBool = (localStorage.getItem(localStorageKey) ? true : false);
  return (conversationBool && botConfigBool);
}



/* fetchBotConfigFromRemote()
 * TODO: currently unused and not complete or tested.
 * Fetch this publisher's latest botConfig from my remote server/bucket/cdn
 * and handle errors.  Returns JSON and caches JSON config in localStorage.
 * See https://dmitripavlutin.com/javascript-fetch-async-await/ for error handling
 * and https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
 * and overall syntax.  This function uses await since the bot can't do 
 * anything without a botConfig so should block.
 */
export async function fetchBotConfigFromRemote(url, localStorageKey) {
  try {
    const response = await fetch(url); // returns a response object
    const resJSON = await response.json(); // converts response object to json
      
    localStorage.setItem(localStorageKey, resJSON); // localStorage can't store objects
    return resJSON;
  } catch (e) {
    console.log(e);
  }
}


/* Return a writeable Svelte store which writes to localStorage whenever it gets updated. 
 * Args:
 *      key: the key used with localStorage    
 *      initial: the default value stored in localStorage. Note this
 *               must be a scalar not an object.  See saveState()
 *               and getOrInitState() if you need to save an object.
 */
function persistent(key, initial) {
  const store = writable(read(key) || initial, () => {
    return store.subscribe(value => {
      try {
        localStorage[key] = value;
      } catch (e) {
        // TODO: better error logging that is surfaced to user
        console.log(`failed to write to localStorage: ${e.code} and ${e.name}`);
      }
    });
  });
  console.log(store);
  return store;
}


// used by persistent function
function read(key) {
  try {
    return localStorage[key];
  } catch (e) {
    console.log(`failed to read from localStorage ${e.code} and ${e.name}`);
  }
}


/* saveBotState(stateToSave, localStorageKey) => undefined
 * Save the current bot's state to localStorage.  
 * Args:
 *   stateToSave : REQUIRED is an Object to save to localStorage
 *   localStorageKey: REQUIRED is a String that uniquely identifies the bot
 */
function saveBotState(stateToSave, localStorageKey) {
  let json = JSON.stringify(stateToSave);
  localStorage.setItem(localStorageKey, json);
}


// localStorageConversationKey(key: String) => String
// Canonical way to create a key to save/retrieve conversation history
// from localStorage. Used by getConversation, saveConversation, deleteConversation
// functions
function localStorageConversationKey(key) {
  return key + 'conversation'
}



/* getConversation(
     key: unique key to this bot
   ) => Conversation object or null if failed to retrieve from 
 *      sessionStorage
 * Session storage survives page refreshes but not tab or browser closure. 
 * There's a unique copy of sessionStorage for every tab.
 */
function getConversation(key) {
  try {
    const conv = JSON.parse(sessionStorage.getItem(localStorageConversationKey(key)));
    return conv;
  } catch (e) { //any type of error return null because we can't use state
    console.log(`error ${e} getting sessionStorage in getConversation()`);
    return null;
  }
}

/* saveConversation(
     conversation: Conversation, 
     key: unique key to this bot
   ) => undefined
 */
function saveConversation(conversation, key) {
  sessionStorage.setItem(localStorageConversationKey(key), JSON.stringify(conversation));
  // TODO: save to remote for analytics.  Note that for some bots, this might
  // include PII so have to drop the actual user replies if publisher
  // indicates it should not be retained and only save the metadata.
}



/* deleteConversation(key: String unique key to this bot) => undefined
 * Delete conversation object in sessionStorage of current conversation allowing
 * conversation restart. */
function deleteConversation(key) {
  sessionStorage.deleteItem(localStorageConversationKey(key));
}


