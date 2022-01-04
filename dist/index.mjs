function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function action_destroyer(action_result) {
    return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
}
function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function set_input_value(input, value) {
    input.value = value == null ? '' : value;
}
function select_option(select, value) {
    for (let i = 0; i < select.options.length; i += 1) {
        const option = select.options[i];
        if (option.__value === value) {
            option.selected = true;
            return;
        }
    }
    select.selectedIndex = -1; // no option should be selected
}
function select_value(select) {
    const selected_option = select.querySelector(':checked') || select.options[0];
    return selected_option && selected_option.__value;
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail, bubbles = false) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, bubbles, false, detail);
    return e;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function afterUpdate(fn) {
    get_current_component().$$.after_update.push(fn);
}
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function tick() {
    schedule_update();
    return resolved_promise;
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* Bot state management 
 * Includes
 *   - persisting conversation state in a session
 *   - persisting bot configuration in the browser
 *   - retriving botConfigs from a remote
 */




/******************* Constants **********************/

// TODO: URL where botConfig JSON is stored - remote fetch not yet supported.
const REMOTE_CONFIG_URL = 'TBD';

// botConfigVersion version will be used to compare against the botConfig file version if
// 1.0.0 is NOT set to a version string. Edit botConfigVersion
// if you are using your own build pipeline and need to adapt to a higher
// version botConfig. 
// See versionCompatible() function and the README for details.
const pkgBotVersion = '1.0.0';
const botVersion = '1.0.0';



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
 *   REQUIRED: newConfig is a boolean that defaults to false, 
 *   set to true to force new botConfig to be loaded
 *   REQUIRED: getConfigFromRemote is a bool that tells this function whether 
 *   to try to get a config from remote if its not already there. See the 
 *   scenarios described at top of Bot.svelte for usage.
 *   REQUIRED: localStorageKey is a unique per bot string
 *   REQUIRED: waitForStartNewConversation: boolean: if false, don't error
 *     if no botConfig in localStorage - caller will wait for startNewConversation
 *     to supply it. Called does want to get BotConfig from localStorage if
 *     available, which is why we need to pass this in. 
 * 
 * If not cached, fetch from remote unless this is the beginning of a
 * a new conversation, in which case always fetch from remote. This is
 * needed because user might restart conversation second time e.g. if
 * then forgot the answer or want to take a different path.  Might be
 * significant time between the first (cached) run and the second one.
 */
function getBotConfig(newConfig, 
                      getConfigFromRemote, 
                      localStorageKey,
                      waitForStartNewConversation) {
  if (newConfig === undefined || getConfigFromRemote === undefined ||
    localStorageKey === undefined || waitForStartNewConversation === undefined) {
      throw new invalidBotConfig(`getBotConfig() in state.js called with missing argument. newConfig=${newConfig}; waitForStartNewConversation= ${waitForStartNewConversation}, getConfigFromRemote=${getConfigFromRemote}; localStorageKey=${localStorageKey}`);
  }

  if (newConfig) {
    // newConfig forces getting from remote even if we have one locally
    botJSON = fetchBotConfigFromRemote(REMOTE_CONFIG_URL, localStorageKey);
  } else {
    // if newConfig is false, only try to get config from remote if not present locally
    let botJSON = localStorage.getItem(localStorageKey);
    if (getConfigFromRemote && !botJSON && !waitForStartNewConversation) {
      botJSON = fetchBotConfigFromRemote(REMOTE_CONFIG_URL, localStorageKey);
    }

    if (botJSON) {
      // parse and freeze botJSON since we got something, return
      // Freeze and return botConfig to ensure reusability in new conversation
      const botConfig = Object.freeze(JSON.parse(botJSON));
      if (versionCompatible(botConfig.version)) return botConfig;
        
    } else if (!waitForStartNewConversation) {
      // if we're here, we failed to get botJSON both locally and from remote
      // AND waitForStartNewConversation is false so caller doesn't want Bot
      // to get BotConfig from startNewConversation(botConfig) so error.
      throw new invalidBotConfig(`getBotConfig() in state.js failed to acquire a botConfig from localStorage and remote and waitForStartNewConversation prop was false`);
    }
    // do nothing if waitForStartNewConversation is true
  }
}



function invalidBotConfig(message) {
	this.name = 'botConfig acquisition error';
  this.message = message;
	this.stack = (new Error()).stack;
}
invalidBotConfig.prototype = new Error;




/* versionCompatible(version: String) => boolean
 * Returns true if the version argument is compatible with the bot client code,
 * raises error otherwise.  "Compatible" means that bot client code can ingest
 * and run the botConfig represented by the version argument. Version argument
 * should be botConfig.version as defined in botConfig.js. This function 
 * compares the version argument's first digit, e.g. the 1 in '1.0.0' with
 * the version in the bot code base's package.json. If it is the same major
 * version then its compatible, otherwise not.  (same as defined by npm in 
 * https://docs.npmjs.com/about-semantic-versioning)
 * 
 * Raises error if version not compatible so can be surfaced in Bot UI. 
 * caller or parent should use try block
 */
function versionCompatible(version) {
  // if deployer of Bot is using `npm run build` 1.0.0 will
  // be set by rollup. If its not set, the constant botConfigVersion
  // at the top of this file will be used. If your build pipeline doesn't use 
  // npm run build, e.g. if you are building Bot into your own website with
  // your own build pipeline, ensure that botConfigVersion is set to the 
  // same major version as the botConfig files you plan to deploy with the bot.
  {
    if (botVersion[0] === version[0]) return true;
  }
  // if we land here versions are incompatible
  throw new invalidBotConfig(
    `botConfig version ${pkgBotVersion} or ${botVersion} doesn't match the version of the configuration file the bot read: ${version}.`);
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
async function fetchBotConfigFromRemote(url, localStorageKey) {
  try {
    const response = await fetch(url); // returns a response object
    const resJSON = await response.json(); // converts response object to json
      
    localStorage.setItem(localStorageKey, resJSON); // localStorage can't store objects
    return resJSON;
  } catch (e) {
    console.log(e);
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

var INUMBER = 'INUMBER';
var IOP1 = 'IOP1';
var IOP2 = 'IOP2';
var IOP3 = 'IOP3';
var IVAR = 'IVAR';
var IVARNAME = 'IVARNAME';
var IFUNCALL = 'IFUNCALL';
var IFUNDEF = 'IFUNDEF';
var IEXPR = 'IEXPR';
var IEXPREVAL = 'IEXPREVAL';
var IMEMBER = 'IMEMBER';
var IENDSTATEMENT = 'IENDSTATEMENT';
var IARRAY = 'IARRAY';

function Instruction(type, value) {
  this.type = type;
  this.value = (value !== undefined && value !== null) ? value : 0;
}

Instruction.prototype.toString = function () {
  switch (this.type) {
    case INUMBER:
    case IOP1:
    case IOP2:
    case IOP3:
    case IVAR:
    case IVARNAME:
    case IENDSTATEMENT:
      return this.value;
    case IFUNCALL:
      return 'CALL ' + this.value;
    case IFUNDEF:
      return 'DEF ' + this.value;
    case IARRAY:
      return 'ARRAY ' + this.value;
    case IMEMBER:
      return '.' + this.value;
    default:
      return 'Invalid Instruction';
  }
};

function unaryInstruction(value) {
  return new Instruction(IOP1, value);
}

function binaryInstruction(value) {
  return new Instruction(IOP2, value);
}

function ternaryInstruction(value) {
  return new Instruction(IOP3, value);
}

function simplify(tokens, unaryOps, binaryOps, ternaryOps, values) {
  var nstack = [];
  var newexpression = [];
  var n1, n2, n3;
  var f;
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === INUMBER || type === IVARNAME) {
      if (Array.isArray(item.value)) {
        nstack.push.apply(nstack, simplify(item.value.map(function (x) {
          return new Instruction(INUMBER, x);
        }).concat(new Instruction(IARRAY, item.value.length)), unaryOps, binaryOps, ternaryOps, values));
      } else {
        nstack.push(item);
      }
    } else if (type === IVAR && values.hasOwnProperty(item.value)) {
      item = new Instruction(INUMBER, values[item.value]);
      nstack.push(item);
    } else if (type === IOP2 && nstack.length > 1) {
      n2 = nstack.pop();
      n1 = nstack.pop();
      f = binaryOps[item.value];
      item = new Instruction(INUMBER, f(n1.value, n2.value));
      nstack.push(item);
    } else if (type === IOP3 && nstack.length > 2) {
      n3 = nstack.pop();
      n2 = nstack.pop();
      n1 = nstack.pop();
      if (item.value === '?') {
        nstack.push(n1.value ? n2.value : n3.value);
      } else {
        f = ternaryOps[item.value];
        item = new Instruction(INUMBER, f(n1.value, n2.value, n3.value));
        nstack.push(item);
      }
    } else if (type === IOP1 && nstack.length > 0) {
      n1 = nstack.pop();
      f = unaryOps[item.value];
      item = new Instruction(INUMBER, f(n1.value));
      nstack.push(item);
    } else if (type === IEXPR) {
      while (nstack.length > 0) {
        newexpression.push(nstack.shift());
      }
      newexpression.push(new Instruction(IEXPR, simplify(item.value, unaryOps, binaryOps, ternaryOps, values)));
    } else if (type === IMEMBER && nstack.length > 0) {
      n1 = nstack.pop();
      nstack.push(new Instruction(INUMBER, n1.value[item.value]));
    } /* else if (type === IARRAY && nstack.length >= item.value) {
      var length = item.value;
      while (length-- > 0) {
        newexpression.push(nstack.pop());
      }
      newexpression.push(new Instruction(IARRAY, item.value));
    } */ else {
      while (nstack.length > 0) {
        newexpression.push(nstack.shift());
      }
      newexpression.push(item);
    }
  }
  while (nstack.length > 0) {
    newexpression.push(nstack.shift());
  }
  return newexpression;
}

function substitute(tokens, variable, expr) {
  var newexpression = [];
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === IVAR && item.value === variable) {
      for (var j = 0; j < expr.tokens.length; j++) {
        var expritem = expr.tokens[j];
        var replitem;
        if (expritem.type === IOP1) {
          replitem = unaryInstruction(expritem.value);
        } else if (expritem.type === IOP2) {
          replitem = binaryInstruction(expritem.value);
        } else if (expritem.type === IOP3) {
          replitem = ternaryInstruction(expritem.value);
        } else {
          replitem = new Instruction(expritem.type, expritem.value);
        }
        newexpression.push(replitem);
      }
    } else if (type === IEXPR) {
      newexpression.push(new Instruction(IEXPR, substitute(item.value, variable, expr)));
    } else {
      newexpression.push(item);
    }
  }
  return newexpression;
}

function evaluate(tokens, expr, values) {
  var nstack = [];
  var n1, n2, n3;
  var f, args, argCount;

  if (isExpressionEvaluator(tokens)) {
    return resolveExpression(tokens, values);
  }

  var numTokens = tokens.length;

  for (var i = 0; i < numTokens; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === INUMBER || type === IVARNAME) {
      nstack.push(item.value);
    } else if (type === IOP2) {
      n2 = nstack.pop();
      n1 = nstack.pop();
      if (item.value === 'and') {
        nstack.push(n1 ? !!evaluate(n2, expr, values) : false);
      } else if (item.value === 'or') {
        nstack.push(n1 ? true : !!evaluate(n2, expr, values));
      } else if (item.value === '=') {
        f = expr.binaryOps[item.value];
        nstack.push(f(n1, evaluate(n2, expr, values), values));
      } else {
        f = expr.binaryOps[item.value];
        nstack.push(f(resolveExpression(n1, values), resolveExpression(n2, values)));
      }
    } else if (type === IOP3) {
      n3 = nstack.pop();
      n2 = nstack.pop();
      n1 = nstack.pop();
      if (item.value === '?') {
        nstack.push(evaluate(n1 ? n2 : n3, expr, values));
      } else {
        f = expr.ternaryOps[item.value];
        nstack.push(f(resolveExpression(n1, values), resolveExpression(n2, values), resolveExpression(n3, values)));
      }
    } else if (type === IVAR) {
      if (item.value in expr.functions) {
        nstack.push(expr.functions[item.value]);
      } else if (item.value in expr.unaryOps && expr.parser.isOperatorEnabled(item.value)) {
        nstack.push(expr.unaryOps[item.value]);
      } else {
        var v = values[item.value];
        if (v !== undefined) {
          nstack.push(v);
        } else {
          throw new Error('undefined variable: ' + item.value);
        }
      }
    } else if (type === IOP1) {
      n1 = nstack.pop();
      f = expr.unaryOps[item.value];
      nstack.push(f(resolveExpression(n1, values)));
    } else if (type === IFUNCALL) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(resolveExpression(nstack.pop(), values));
      }
      f = nstack.pop();
      if (f.apply && f.call) {
        nstack.push(f.apply(undefined, args));
      } else {
        throw new Error(f + ' is not a function');
      }
    } else if (type === IFUNDEF) {
      // Create closure to keep references to arguments and expression
      nstack.push((function () {
        var n2 = nstack.pop();
        var args = [];
        var argCount = item.value;
        while (argCount-- > 0) {
          args.unshift(nstack.pop());
        }
        var n1 = nstack.pop();
        var f = function () {
          var scope = Object.assign({}, values);
          for (var i = 0, len = args.length; i < len; i++) {
            scope[args[i]] = arguments[i];
          }
          return evaluate(n2, expr, scope);
        };
        // f.name = n1
        Object.defineProperty(f, 'name', {
          value: n1,
          writable: false
        });
        values[n1] = f;
        return f;
      })());
    } else if (type === IEXPR) {
      nstack.push(createExpressionEvaluator(item, expr));
    } else if (type === IEXPREVAL) {
      nstack.push(item);
    } else if (type === IMEMBER) {
      n1 = nstack.pop();
      nstack.push(n1[item.value]);
    } else if (type === IENDSTATEMENT) {
      nstack.pop();
    } else if (type === IARRAY) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      nstack.push(args);
    } else {
      throw new Error('invalid Expression');
    }
  }
  if (nstack.length > 1) {
    throw new Error('invalid Expression (parity)');
  }
  // Explicitly return zero to avoid test issues caused by -0
  return nstack[0] === 0 ? 0 : resolveExpression(nstack[0], values);
}

function createExpressionEvaluator(token, expr, values) {
  if (isExpressionEvaluator(token)) return token;
  return {
    type: IEXPREVAL,
    value: function (scope) {
      return evaluate(token.value, expr, scope);
    }
  };
}

function isExpressionEvaluator(n) {
  return n && n.type === IEXPREVAL;
}

function resolveExpression(n, values) {
  return isExpressionEvaluator(n) ? n.value(values) : n;
}

function expressionToString(tokens, toJS) {
  var nstack = [];
  var n1, n2, n3;
  var f, args, argCount;
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === INUMBER) {
      if (typeof item.value === 'number' && item.value < 0) {
        nstack.push('(' + item.value + ')');
      } else if (Array.isArray(item.value)) {
        nstack.push('[' + item.value.map(escapeValue).join(', ') + ']');
      } else {
        nstack.push(escapeValue(item.value));
      }
    } else if (type === IOP2) {
      n2 = nstack.pop();
      n1 = nstack.pop();
      f = item.value;
      if (toJS) {
        if (f === '^') {
          nstack.push('Math.pow(' + n1 + ', ' + n2 + ')');
        } else if (f === 'and') {
          nstack.push('(!!' + n1 + ' && !!' + n2 + ')');
        } else if (f === 'or') {
          nstack.push('(!!' + n1 + ' || !!' + n2 + ')');
        } else if (f === '||') {
          nstack.push('(function(a,b){ return Array.isArray(a) && Array.isArray(b) ? a.concat(b) : String(a) + String(b); }((' + n1 + '),(' + n2 + ')))');
        } else if (f === '==') {
          nstack.push('(' + n1 + ' === ' + n2 + ')');
        } else if (f === '!=') {
          nstack.push('(' + n1 + ' !== ' + n2 + ')');
        } else if (f === '[') {
          nstack.push(n1 + '[(' + n2 + ') | 0]');
        } else {
          nstack.push('(' + n1 + ' ' + f + ' ' + n2 + ')');
        }
      } else {
        if (f === '[') {
          nstack.push(n1 + '[' + n2 + ']');
        } else {
          nstack.push('(' + n1 + ' ' + f + ' ' + n2 + ')');
        }
      }
    } else if (type === IOP3) {
      n3 = nstack.pop();
      n2 = nstack.pop();
      n1 = nstack.pop();
      f = item.value;
      if (f === '?') {
        nstack.push('(' + n1 + ' ? ' + n2 + ' : ' + n3 + ')');
      } else {
        throw new Error('invalid Expression');
      }
    } else if (type === IVAR || type === IVARNAME) {
      nstack.push(item.value);
    } else if (type === IOP1) {
      n1 = nstack.pop();
      f = item.value;
      if (f === '-' || f === '+') {
        nstack.push('(' + f + n1 + ')');
      } else if (toJS) {
        if (f === 'not') {
          nstack.push('(' + '!' + n1 + ')');
        } else if (f === '!') {
          nstack.push('fac(' + n1 + ')');
        } else {
          nstack.push(f + '(' + n1 + ')');
        }
      } else if (f === '!') {
        nstack.push('(' + n1 + '!)');
      } else {
        nstack.push('(' + f + ' ' + n1 + ')');
      }
    } else if (type === IFUNCALL) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      f = nstack.pop();
      nstack.push(f + '(' + args.join(', ') + ')');
    } else if (type === IFUNDEF) {
      n2 = nstack.pop();
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      n1 = nstack.pop();
      if (toJS) {
        nstack.push('(' + n1 + ' = function(' + args.join(', ') + ') { return ' + n2 + ' })');
      } else {
        nstack.push('(' + n1 + '(' + args.join(', ') + ') = ' + n2 + ')');
      }
    } else if (type === IMEMBER) {
      n1 = nstack.pop();
      nstack.push(n1 + '.' + item.value);
    } else if (type === IARRAY) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      nstack.push('[' + args.join(', ') + ']');
    } else if (type === IEXPR) {
      nstack.push('(' + expressionToString(item.value, toJS) + ')');
    } else if (type === IENDSTATEMENT) ; else {
      throw new Error('invalid Expression');
    }
  }
  if (nstack.length > 1) {
    if (toJS) {
      nstack = [ nstack.join(',') ];
    } else {
      nstack = [ nstack.join(';') ];
    }
  }
  return String(nstack[0]);
}

function escapeValue(v) {
  if (typeof v === 'string') {
    return JSON.stringify(v).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }
  return v;
}

function contains$1(array, obj) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] === obj) {
      return true;
    }
  }
  return false;
}

function getSymbols(tokens, symbols, options) {
  options = options || {};
  var withMembers = !!options.withMembers;
  var prevVar = null;

  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    if (item.type === IVAR || item.type === IVARNAME) {
      if (!withMembers && !contains$1(symbols, item.value)) {
        symbols.push(item.value);
      } else if (prevVar !== null) {
        if (!contains$1(symbols, prevVar)) {
          symbols.push(prevVar);
        }
        prevVar = item.value;
      } else {
        prevVar = item.value;
      }
    } else if (item.type === IMEMBER && withMembers && prevVar !== null) {
      prevVar += '.' + item.value;
    } else if (item.type === IEXPR) {
      getSymbols(item.value, symbols, options);
    } else if (prevVar !== null) {
      if (!contains$1(symbols, prevVar)) {
        symbols.push(prevVar);
      }
      prevVar = null;
    }
  }

  if (prevVar !== null && !contains$1(symbols, prevVar)) {
    symbols.push(prevVar);
  }
}

function Expression(tokens, parser) {
  this.tokens = tokens;
  this.parser = parser;
  this.unaryOps = parser.unaryOps;
  this.binaryOps = parser.binaryOps;
  this.ternaryOps = parser.ternaryOps;
  this.functions = parser.functions;
}

Expression.prototype.simplify = function (values) {
  values = values || {};
  return new Expression(simplify(this.tokens, this.unaryOps, this.binaryOps, this.ternaryOps, values), this.parser);
};

Expression.prototype.substitute = function (variable, expr) {
  if (!(expr instanceof Expression)) {
    expr = this.parser.parse(String(expr));
  }

  return new Expression(substitute(this.tokens, variable, expr), this.parser);
};

Expression.prototype.evaluate = function (values) {
  values = values || {};
  return evaluate(this.tokens, this, values);
};

Expression.prototype.toString = function () {
  return expressionToString(this.tokens, false);
};

Expression.prototype.symbols = function (options) {
  options = options || {};
  var vars = [];
  getSymbols(this.tokens, vars, options);
  return vars;
};

Expression.prototype.variables = function (options) {
  options = options || {};
  var vars = [];
  getSymbols(this.tokens, vars, options);
  var functions = this.functions;
  return vars.filter(function (name) {
    return !(name in functions);
  });
};

Expression.prototype.toJSFunction = function (param, variables) {
  var expr = this;
  var f = new Function(param, 'with(this.functions) with (this.ternaryOps) with (this.binaryOps) with (this.unaryOps) { return ' + expressionToString(this.simplify(variables).tokens, true) + '; }'); // eslint-disable-line no-new-func
  return function () {
    return f.apply(expr, arguments);
  };
};

var TEOF = 'TEOF';
var TOP = 'TOP';
var TNUMBER = 'TNUMBER';
var TSTRING = 'TSTRING';
var TPAREN = 'TPAREN';
var TBRACKET = 'TBRACKET';
var TCOMMA = 'TCOMMA';
var TNAME = 'TNAME';
var TSEMICOLON = 'TSEMICOLON';

function Token(type, value, index) {
  this.type = type;
  this.value = value;
  this.index = index;
}

Token.prototype.toString = function () {
  return this.type + ': ' + this.value;
};

function TokenStream(parser, expression) {
  this.pos = 0;
  this.current = null;
  this.unaryOps = parser.unaryOps;
  this.binaryOps = parser.binaryOps;
  this.ternaryOps = parser.ternaryOps;
  this.consts = parser.consts;
  this.expression = expression;
  this.savedPosition = 0;
  this.savedCurrent = null;
  this.options = parser.options;
  this.parser = parser;
}

TokenStream.prototype.newToken = function (type, value, pos) {
  return new Token(type, value, pos != null ? pos : this.pos);
};

TokenStream.prototype.save = function () {
  this.savedPosition = this.pos;
  this.savedCurrent = this.current;
};

TokenStream.prototype.restore = function () {
  this.pos = this.savedPosition;
  this.current = this.savedCurrent;
};

TokenStream.prototype.next = function () {
  if (this.pos >= this.expression.length) {
    return this.newToken(TEOF, 'EOF');
  }

  if (this.isWhitespace() || this.isComment()) {
    return this.next();
  } else if (this.isRadixInteger() ||
      this.isNumber() ||
      this.isOperator() ||
      this.isString() ||
      this.isParen() ||
      this.isBracket() ||
      this.isComma() ||
      this.isSemicolon() ||
      this.isNamedOp() ||
      this.isConst() ||
      this.isName()) {
    return this.current;
  } else {
    this.parseError('Unknown character "' + this.expression.charAt(this.pos) + '"');
  }
};

TokenStream.prototype.isString = function () {
  var r = false;
  var startPos = this.pos;
  var quote = this.expression.charAt(startPos);

  if (quote === '\'' || quote === '"') {
    var index = this.expression.indexOf(quote, startPos + 1);
    while (index >= 0 && this.pos < this.expression.length) {
      this.pos = index + 1;
      if (this.expression.charAt(index - 1) !== '\\') {
        var rawString = this.expression.substring(startPos + 1, index);
        this.current = this.newToken(TSTRING, this.unescape(rawString), startPos);
        r = true;
        break;
      }
      index = this.expression.indexOf(quote, index + 1);
    }
  }
  return r;
};

TokenStream.prototype.isParen = function () {
  var c = this.expression.charAt(this.pos);
  if (c === '(' || c === ')') {
    this.current = this.newToken(TPAREN, c);
    this.pos++;
    return true;
  }
  return false;
};

TokenStream.prototype.isBracket = function () {
  var c = this.expression.charAt(this.pos);
  if ((c === '[' || c === ']') && this.isOperatorEnabled('[')) {
    this.current = this.newToken(TBRACKET, c);
    this.pos++;
    return true;
  }
  return false;
};

TokenStream.prototype.isComma = function () {
  var c = this.expression.charAt(this.pos);
  if (c === ',') {
    this.current = this.newToken(TCOMMA, ',');
    this.pos++;
    return true;
  }
  return false;
};

TokenStream.prototype.isSemicolon = function () {
  var c = this.expression.charAt(this.pos);
  if (c === ';') {
    this.current = this.newToken(TSEMICOLON, ';');
    this.pos++;
    return true;
  }
  return false;
};

TokenStream.prototype.isConst = function () {
  var startPos = this.pos;
  var i = startPos;
  for (; i < this.expression.length; i++) {
    var c = this.expression.charAt(i);
    if (c.toUpperCase() === c.toLowerCase()) {
      if (i === this.pos || (c !== '_' && c !== '.' && (c < '0' || c > '9'))) {
        break;
      }
    }
  }
  if (i > startPos) {
    var str = this.expression.substring(startPos, i);
    if (str in this.consts) {
      this.current = this.newToken(TNUMBER, this.consts[str]);
      this.pos += str.length;
      return true;
    }
  }
  return false;
};

TokenStream.prototype.isNamedOp = function () {
  var startPos = this.pos;
  var i = startPos;
  for (; i < this.expression.length; i++) {
    var c = this.expression.charAt(i);
    if (c.toUpperCase() === c.toLowerCase()) {
      if (i === this.pos || (c !== '_' && (c < '0' || c > '9'))) {
        break;
      }
    }
  }
  if (i > startPos) {
    var str = this.expression.substring(startPos, i);
    if (this.isOperatorEnabled(str) && (str in this.binaryOps || str in this.unaryOps || str in this.ternaryOps)) {
      this.current = this.newToken(TOP, str);
      this.pos += str.length;
      return true;
    }
  }
  return false;
};

TokenStream.prototype.isName = function () {
  var startPos = this.pos;
  var i = startPos;
  var hasLetter = false;
  for (; i < this.expression.length; i++) {
    var c = this.expression.charAt(i);
    if (c.toUpperCase() === c.toLowerCase()) {
      if (i === this.pos && (c === '$' || c === '_')) {
        if (c === '_') {
          hasLetter = true;
        }
        continue;
      } else if (i === this.pos || !hasLetter || (c !== '_' && (c < '0' || c > '9'))) {
        break;
      }
    } else {
      hasLetter = true;
    }
  }
  if (hasLetter) {
    var str = this.expression.substring(startPos, i);
    this.current = this.newToken(TNAME, str);
    this.pos += str.length;
    return true;
  }
  return false;
};

TokenStream.prototype.isWhitespace = function () {
  var r = false;
  var c = this.expression.charAt(this.pos);
  while (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
    r = true;
    this.pos++;
    if (this.pos >= this.expression.length) {
      break;
    }
    c = this.expression.charAt(this.pos);
  }
  return r;
};

var codePointPattern = /^[0-9a-f]{4}$/i;

TokenStream.prototype.unescape = function (v) {
  var index = v.indexOf('\\');
  if (index < 0) {
    return v;
  }

  var buffer = v.substring(0, index);
  while (index >= 0) {
    var c = v.charAt(++index);
    switch (c) {
      case '\'':
        buffer += '\'';
        break;
      case '"':
        buffer += '"';
        break;
      case '\\':
        buffer += '\\';
        break;
      case '/':
        buffer += '/';
        break;
      case 'b':
        buffer += '\b';
        break;
      case 'f':
        buffer += '\f';
        break;
      case 'n':
        buffer += '\n';
        break;
      case 'r':
        buffer += '\r';
        break;
      case 't':
        buffer += '\t';
        break;
      case 'u':
        // interpret the following 4 characters as the hex of the unicode code point
        var codePoint = v.substring(index + 1, index + 5);
        if (!codePointPattern.test(codePoint)) {
          this.parseError('Illegal escape sequence: \\u' + codePoint);
        }
        buffer += String.fromCharCode(parseInt(codePoint, 16));
        index += 4;
        break;
      default:
        throw this.parseError('Illegal escape sequence: "\\' + c + '"');
    }
    ++index;
    var backslash = v.indexOf('\\', index);
    buffer += v.substring(index, backslash < 0 ? v.length : backslash);
    index = backslash;
  }

  return buffer;
};

TokenStream.prototype.isComment = function () {
  var c = this.expression.charAt(this.pos);
  if (c === '/' && this.expression.charAt(this.pos + 1) === '*') {
    this.pos = this.expression.indexOf('*/', this.pos) + 2;
    if (this.pos === 1) {
      this.pos = this.expression.length;
    }
    return true;
  }
  return false;
};

TokenStream.prototype.isRadixInteger = function () {
  var pos = this.pos;

  if (pos >= this.expression.length - 2 || this.expression.charAt(pos) !== '0') {
    return false;
  }
  ++pos;

  var radix;
  var validDigit;
  if (this.expression.charAt(pos) === 'x') {
    radix = 16;
    validDigit = /^[0-9a-f]$/i;
    ++pos;
  } else if (this.expression.charAt(pos) === 'b') {
    radix = 2;
    validDigit = /^[01]$/i;
    ++pos;
  } else {
    return false;
  }

  var valid = false;
  var startPos = pos;

  while (pos < this.expression.length) {
    var c = this.expression.charAt(pos);
    if (validDigit.test(c)) {
      pos++;
      valid = true;
    } else {
      break;
    }
  }

  if (valid) {
    this.current = this.newToken(TNUMBER, parseInt(this.expression.substring(startPos, pos), radix));
    this.pos = pos;
  }
  return valid;
};

TokenStream.prototype.isNumber = function () {
  var valid = false;
  var pos = this.pos;
  var startPos = pos;
  var resetPos = pos;
  var foundDot = false;
  var foundDigits = false;
  var c;

  while (pos < this.expression.length) {
    c = this.expression.charAt(pos);
    if ((c >= '0' && c <= '9') || (!foundDot && c === '.')) {
      if (c === '.') {
        foundDot = true;
      } else {
        foundDigits = true;
      }
      pos++;
      valid = foundDigits;
    } else {
      break;
    }
  }

  if (valid) {
    resetPos = pos;
  }

  if (c === 'e' || c === 'E') {
    pos++;
    var acceptSign = true;
    var validExponent = false;
    while (pos < this.expression.length) {
      c = this.expression.charAt(pos);
      if (acceptSign && (c === '+' || c === '-')) {
        acceptSign = false;
      } else if (c >= '0' && c <= '9') {
        validExponent = true;
        acceptSign = false;
      } else {
        break;
      }
      pos++;
    }

    if (!validExponent) {
      pos = resetPos;
    }
  }

  if (valid) {
    this.current = this.newToken(TNUMBER, parseFloat(this.expression.substring(startPos, pos)));
    this.pos = pos;
  } else {
    this.pos = resetPos;
  }
  return valid;
};

TokenStream.prototype.isOperator = function () {
  var startPos = this.pos;
  var c = this.expression.charAt(this.pos);

  if (c === '+' || c === '-' || c === '*' || c === '/' || c === '%' || c === '^' || c === '?' || c === ':' || c === '.') {
    this.current = this.newToken(TOP, c);
  } else if (c === '∙' || c === '•') {
    this.current = this.newToken(TOP, '*');
  } else if (c === '>') {
    if (this.expression.charAt(this.pos + 1) === '=') {
      this.current = this.newToken(TOP, '>=');
      this.pos++;
    } else {
      this.current = this.newToken(TOP, '>');
    }
  } else if (c === '<') {
    if (this.expression.charAt(this.pos + 1) === '=') {
      this.current = this.newToken(TOP, '<=');
      this.pos++;
    } else {
      this.current = this.newToken(TOP, '<');
    }
  } else if (c === '|') {
    if (this.expression.charAt(this.pos + 1) === '|') {
      this.current = this.newToken(TOP, '||');
      this.pos++;
    } else {
      return false;
    }
  } else if (c === '=') {
    if (this.expression.charAt(this.pos + 1) === '=') {
      this.current = this.newToken(TOP, '==');
      this.pos++;
    } else {
      this.current = this.newToken(TOP, c);
    }
  } else if (c === '!') {
    if (this.expression.charAt(this.pos + 1) === '=') {
      this.current = this.newToken(TOP, '!=');
      this.pos++;
    } else {
      this.current = this.newToken(TOP, c);
    }
  } else {
    return false;
  }
  this.pos++;

  if (this.isOperatorEnabled(this.current.value)) {
    return true;
  } else {
    this.pos = startPos;
    return false;
  }
};

TokenStream.prototype.isOperatorEnabled = function (op) {
  return this.parser.isOperatorEnabled(op);
};

TokenStream.prototype.getCoordinates = function () {
  var line = 0;
  var column;
  var newline = -1;
  do {
    line++;
    column = this.pos - newline;
    newline = this.expression.indexOf('\n', newline + 1);
  } while (newline >= 0 && newline < this.pos);

  return {
    line: line,
    column: column
  };
};

TokenStream.prototype.parseError = function (msg) {
  var coords = this.getCoordinates();
  throw new Error('parse error [' + coords.line + ':' + coords.column + ']: ' + msg);
};

function ParserState(parser, tokenStream, options) {
  this.parser = parser;
  this.tokens = tokenStream;
  this.current = null;
  this.nextToken = null;
  this.next();
  this.savedCurrent = null;
  this.savedNextToken = null;
  this.allowMemberAccess = options.allowMemberAccess !== false;
}

ParserState.prototype.next = function () {
  this.current = this.nextToken;
  return (this.nextToken = this.tokens.next());
};

ParserState.prototype.tokenMatches = function (token, value) {
  if (typeof value === 'undefined') {
    return true;
  } else if (Array.isArray(value)) {
    return contains$1(value, token.value);
  } else if (typeof value === 'function') {
    return value(token);
  } else {
    return token.value === value;
  }
};

ParserState.prototype.save = function () {
  this.savedCurrent = this.current;
  this.savedNextToken = this.nextToken;
  this.tokens.save();
};

ParserState.prototype.restore = function () {
  this.tokens.restore();
  this.current = this.savedCurrent;
  this.nextToken = this.savedNextToken;
};

ParserState.prototype.accept = function (type, value) {
  if (this.nextToken.type === type && this.tokenMatches(this.nextToken, value)) {
    this.next();
    return true;
  }
  return false;
};

ParserState.prototype.expect = function (type, value) {
  if (!this.accept(type, value)) {
    var coords = this.tokens.getCoordinates();
    throw new Error('parse error [' + coords.line + ':' + coords.column + ']: Expected ' + (value || type));
  }
};

ParserState.prototype.parseAtom = function (instr) {
  var unaryOps = this.tokens.unaryOps;
  function isPrefixOperator(token) {
    return token.value in unaryOps;
  }

  if (this.accept(TNAME) || this.accept(TOP, isPrefixOperator)) {
    instr.push(new Instruction(IVAR, this.current.value));
  } else if (this.accept(TNUMBER)) {
    instr.push(new Instruction(INUMBER, this.current.value));
  } else if (this.accept(TSTRING)) {
    instr.push(new Instruction(INUMBER, this.current.value));
  } else if (this.accept(TPAREN, '(')) {
    this.parseExpression(instr);
    this.expect(TPAREN, ')');
  } else if (this.accept(TBRACKET, '[')) {
    if (this.accept(TBRACKET, ']')) {
      instr.push(new Instruction(IARRAY, 0));
    } else {
      var argCount = this.parseArrayList(instr);
      instr.push(new Instruction(IARRAY, argCount));
    }
  } else {
    throw new Error('unexpected ' + this.nextToken);
  }
};

ParserState.prototype.parseExpression = function (instr) {
  var exprInstr = [];
  if (this.parseUntilEndStatement(instr, exprInstr)) {
    return;
  }
  this.parseVariableAssignmentExpression(exprInstr);
  if (this.parseUntilEndStatement(instr, exprInstr)) {
    return;
  }
  this.pushExpression(instr, exprInstr);
};

ParserState.prototype.pushExpression = function (instr, exprInstr) {
  for (var i = 0, len = exprInstr.length; i < len; i++) {
    instr.push(exprInstr[i]);
  }
};

ParserState.prototype.parseUntilEndStatement = function (instr, exprInstr) {
  if (!this.accept(TSEMICOLON)) return false;
  if (this.nextToken && this.nextToken.type !== TEOF && !(this.nextToken.type === TPAREN && this.nextToken.value === ')')) {
    exprInstr.push(new Instruction(IENDSTATEMENT));
  }
  if (this.nextToken.type !== TEOF) {
    this.parseExpression(exprInstr);
  }
  instr.push(new Instruction(IEXPR, exprInstr));
  return true;
};

ParserState.prototype.parseArrayList = function (instr) {
  var argCount = 0;

  while (!this.accept(TBRACKET, ']')) {
    this.parseExpression(instr);
    ++argCount;
    while (this.accept(TCOMMA)) {
      this.parseExpression(instr);
      ++argCount;
    }
  }

  return argCount;
};

ParserState.prototype.parseVariableAssignmentExpression = function (instr) {
  this.parseConditionalExpression(instr);
  while (this.accept(TOP, '=')) {
    var varName = instr.pop();
    var varValue = [];
    var lastInstrIndex = instr.length - 1;
    if (varName.type === IFUNCALL) {
      if (!this.tokens.isOperatorEnabled('()=')) {
        throw new Error('function definition is not permitted');
      }
      for (var i = 0, len = varName.value + 1; i < len; i++) {
        var index = lastInstrIndex - i;
        if (instr[index].type === IVAR) {
          instr[index] = new Instruction(IVARNAME, instr[index].value);
        }
      }
      this.parseVariableAssignmentExpression(varValue);
      instr.push(new Instruction(IEXPR, varValue));
      instr.push(new Instruction(IFUNDEF, varName.value));
      continue;
    }
    if (varName.type !== IVAR && varName.type !== IMEMBER) {
      throw new Error('expected variable for assignment');
    }
    this.parseVariableAssignmentExpression(varValue);
    instr.push(new Instruction(IVARNAME, varName.value));
    instr.push(new Instruction(IEXPR, varValue));
    instr.push(binaryInstruction('='));
  }
};

ParserState.prototype.parseConditionalExpression = function (instr) {
  this.parseOrExpression(instr);
  while (this.accept(TOP, '?')) {
    var trueBranch = [];
    var falseBranch = [];
    this.parseConditionalExpression(trueBranch);
    this.expect(TOP, ':');
    this.parseConditionalExpression(falseBranch);
    instr.push(new Instruction(IEXPR, trueBranch));
    instr.push(new Instruction(IEXPR, falseBranch));
    instr.push(ternaryInstruction('?'));
  }
};

ParserState.prototype.parseOrExpression = function (instr) {
  this.parseAndExpression(instr);
  while (this.accept(TOP, 'or')) {
    var falseBranch = [];
    this.parseAndExpression(falseBranch);
    instr.push(new Instruction(IEXPR, falseBranch));
    instr.push(binaryInstruction('or'));
  }
};

ParserState.prototype.parseAndExpression = function (instr) {
  this.parseComparison(instr);
  while (this.accept(TOP, 'and')) {
    var trueBranch = [];
    this.parseComparison(trueBranch);
    instr.push(new Instruction(IEXPR, trueBranch));
    instr.push(binaryInstruction('and'));
  }
};

var COMPARISON_OPERATORS = ['==', '!=', '<', '<=', '>=', '>', 'in'];

ParserState.prototype.parseComparison = function (instr) {
  this.parseAddSub(instr);
  while (this.accept(TOP, COMPARISON_OPERATORS)) {
    var op = this.current;
    this.parseAddSub(instr);
    instr.push(binaryInstruction(op.value));
  }
};

var ADD_SUB_OPERATORS = ['+', '-', '||'];

ParserState.prototype.parseAddSub = function (instr) {
  this.parseTerm(instr);
  while (this.accept(TOP, ADD_SUB_OPERATORS)) {
    var op = this.current;
    this.parseTerm(instr);
    instr.push(binaryInstruction(op.value));
  }
};

var TERM_OPERATORS = ['*', '/', '%'];

ParserState.prototype.parseTerm = function (instr) {
  this.parseFactor(instr);
  while (this.accept(TOP, TERM_OPERATORS)) {
    var op = this.current;
    this.parseFactor(instr);
    instr.push(binaryInstruction(op.value));
  }
};

ParserState.prototype.parseFactor = function (instr) {
  var unaryOps = this.tokens.unaryOps;
  function isPrefixOperator(token) {
    return token.value in unaryOps;
  }

  this.save();
  if (this.accept(TOP, isPrefixOperator)) {
    if (this.current.value !== '-' && this.current.value !== '+') {
      if (this.nextToken.type === TPAREN && this.nextToken.value === '(') {
        this.restore();
        this.parseExponential(instr);
        return;
      } else if (this.nextToken.type === TSEMICOLON || this.nextToken.type === TCOMMA || this.nextToken.type === TEOF || (this.nextToken.type === TPAREN && this.nextToken.value === ')')) {
        this.restore();
        this.parseAtom(instr);
        return;
      }
    }

    var op = this.current;
    this.parseFactor(instr);
    instr.push(unaryInstruction(op.value));
  } else {
    this.parseExponential(instr);
  }
};

ParserState.prototype.parseExponential = function (instr) {
  this.parsePostfixExpression(instr);
  while (this.accept(TOP, '^')) {
    this.parseFactor(instr);
    instr.push(binaryInstruction('^'));
  }
};

ParserState.prototype.parsePostfixExpression = function (instr) {
  this.parseFunctionCall(instr);
  while (this.accept(TOP, '!')) {
    instr.push(unaryInstruction('!'));
  }
};

ParserState.prototype.parseFunctionCall = function (instr) {
  var unaryOps = this.tokens.unaryOps;
  function isPrefixOperator(token) {
    return token.value in unaryOps;
  }

  if (this.accept(TOP, isPrefixOperator)) {
    var op = this.current;
    this.parseAtom(instr);
    instr.push(unaryInstruction(op.value));
  } else {
    this.parseMemberExpression(instr);
    while (this.accept(TPAREN, '(')) {
      if (this.accept(TPAREN, ')')) {
        instr.push(new Instruction(IFUNCALL, 0));
      } else {
        var argCount = this.parseArgumentList(instr);
        instr.push(new Instruction(IFUNCALL, argCount));
      }
    }
  }
};

ParserState.prototype.parseArgumentList = function (instr) {
  var argCount = 0;

  while (!this.accept(TPAREN, ')')) {
    this.parseExpression(instr);
    ++argCount;
    while (this.accept(TCOMMA)) {
      this.parseExpression(instr);
      ++argCount;
    }
  }

  return argCount;
};

ParserState.prototype.parseMemberExpression = function (instr) {
  this.parseAtom(instr);
  while (this.accept(TOP, '.') || this.accept(TBRACKET, '[')) {
    var op = this.current;

    if (op.value === '.') {
      if (!this.allowMemberAccess) {
        throw new Error('unexpected ".", member access is not permitted');
      }

      this.expect(TNAME);
      instr.push(new Instruction(IMEMBER, this.current.value));
    } else if (op.value === '[') {
      if (!this.tokens.isOperatorEnabled('[')) {
        throw new Error('unexpected "[]", arrays are disabled');
      }

      this.parseExpression(instr);
      this.expect(TBRACKET, ']');
      instr.push(binaryInstruction('['));
    } else {
      throw new Error('unexpected symbol: ' + op.value);
    }
  }
};

function add(a, b) {
  return Number(a) + Number(b);
}

function sub(a, b) {
  return a - b;
}

function mul(a, b) {
  return a * b;
}

function div(a, b) {
  return a / b;
}

function mod(a, b) {
  return a % b;
}

function concat(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.concat(b);
  }
  return '' + a + b;
}

function equal(a, b) {
  return a === b;
}

function notEqual(a, b) {
  return a !== b;
}

function greaterThan(a, b) {
  return a > b;
}

function lessThan(a, b) {
  return a < b;
}

function greaterThanEqual(a, b) {
  return a >= b;
}

function lessThanEqual(a, b) {
  return a <= b;
}

function andOperator(a, b) {
  return Boolean(a && b);
}

function orOperator(a, b) {
  return Boolean(a || b);
}

function inOperator(a, b) {
  return contains$1(b, a);
}

function sinh(a) {
  return ((Math.exp(a) - Math.exp(-a)) / 2);
}

function cosh(a) {
  return ((Math.exp(a) + Math.exp(-a)) / 2);
}

function tanh(a) {
  if (a === Infinity) return 1;
  if (a === -Infinity) return -1;
  return (Math.exp(a) - Math.exp(-a)) / (Math.exp(a) + Math.exp(-a));
}

function asinh(a) {
  if (a === -Infinity) return a;
  return Math.log(a + Math.sqrt((a * a) + 1));
}

function acosh(a) {
  return Math.log(a + Math.sqrt((a * a) - 1));
}

function atanh(a) {
  return (Math.log((1 + a) / (1 - a)) / 2);
}

function log10(a) {
  return Math.log(a) * Math.LOG10E;
}

function neg(a) {
  return -a;
}

function not(a) {
  return !a;
}

function trunc(a) {
  return a < 0 ? Math.ceil(a) : Math.floor(a);
}

function random(a) {
  return Math.random() * (a || 1);
}

function factorial(a) { // a!
  return gamma(a + 1);
}

function isInteger(value) {
  return isFinite(value) && (value === Math.round(value));
}

var GAMMA_G = 4.7421875;
var GAMMA_P = [
  0.99999999999999709182,
  57.156235665862923517, -59.597960355475491248,
  14.136097974741747174, -0.49191381609762019978,
  0.33994649984811888699e-4,
  0.46523628927048575665e-4, -0.98374475304879564677e-4,
  0.15808870322491248884e-3, -0.21026444172410488319e-3,
  0.21743961811521264320e-3, -0.16431810653676389022e-3,
  0.84418223983852743293e-4, -0.26190838401581408670e-4,
  0.36899182659531622704e-5
];

// Gamma function from math.js
function gamma(n) {
  var t, x;

  if (isInteger(n)) {
    if (n <= 0) {
      return isFinite(n) ? Infinity : NaN;
    }

    if (n > 171) {
      return Infinity; // Will overflow
    }

    var value = n - 2;
    var res = n - 1;
    while (value > 1) {
      res *= value;
      value--;
    }

    if (res === 0) {
      res = 1; // 0! is per definition 1
    }

    return res;
  }

  if (n < 0.5) {
    return Math.PI / (Math.sin(Math.PI * n) * gamma(1 - n));
  }

  if (n >= 171.35) {
    return Infinity; // will overflow
  }

  if (n > 85.0) { // Extended Stirling Approx
    var twoN = n * n;
    var threeN = twoN * n;
    var fourN = threeN * n;
    var fiveN = fourN * n;
    return Math.sqrt(2 * Math.PI / n) * Math.pow((n / Math.E), n) *
      (1 + (1 / (12 * n)) + (1 / (288 * twoN)) - (139 / (51840 * threeN)) -
      (571 / (2488320 * fourN)) + (163879 / (209018880 * fiveN)) +
      (5246819 / (75246796800 * fiveN * n)));
  }

  --n;
  x = GAMMA_P[0];
  for (var i = 1; i < GAMMA_P.length; ++i) {
    x += GAMMA_P[i] / (n + i);
  }

  t = n + GAMMA_G + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, n + 0.5) * Math.exp(-t) * x;
}

function stringOrArrayLength(s) {
  if (Array.isArray(s)) {
    return s.length;
  }
  return String(s).length;
}

function hypot() {
  var sum = 0;
  var larg = 0;
  for (var i = 0; i < arguments.length; i++) {
    var arg = Math.abs(arguments[i]);
    var div;
    if (larg < arg) {
      div = larg / arg;
      sum = (sum * div * div) + 1;
      larg = arg;
    } else if (arg > 0) {
      div = arg / larg;
      sum += div * div;
    } else {
      sum += arg;
    }
  }
  return larg === Infinity ? Infinity : larg * Math.sqrt(sum);
}

function condition(cond, yep, nope) {
  return cond ? yep : nope;
}

/**
* Decimal adjustment of a number.
* From @escopecz.
*
* @param {Number} value The number.
* @param {Integer} exp  The exponent (the 10 logarithm of the adjustment base).
* @return {Number} The adjusted value.
*/
function roundTo(value, exp) {
  // If the exp is undefined or zero...
  if (typeof exp === 'undefined' || +exp === 0) {
    return Math.round(value);
  }
  value = +value;
  exp = -(+exp);
  // If the value is not a number or the exp is not an integer...
  if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
    return NaN;
  }
  // Shift
  value = value.toString().split('e');
  value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
  // Shift back
  value = value.toString().split('e');
  return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
}

function setVar(name, value, variables) {
  if (variables) variables[name] = value;
  return value;
}

function arrayIndex(array, index) {
  return array[index | 0];
}

function max(array) {
  if (arguments.length === 1 && Array.isArray(array)) {
    return Math.max.apply(Math, array);
  } else {
    return Math.max.apply(Math, arguments);
  }
}

function min(array) {
  if (arguments.length === 1 && Array.isArray(array)) {
    return Math.min.apply(Math, array);
  } else {
    return Math.min.apply(Math, arguments);
  }
}

function arrayMap(f, a) {
  if (typeof f !== 'function') {
    throw new Error('First argument to map is not a function');
  }
  if (!Array.isArray(a)) {
    throw new Error('Second argument to map is not an array');
  }
  return a.map(function (x, i) {
    return f(x, i);
  });
}

function arrayFold(f, init, a) {
  if (typeof f !== 'function') {
    throw new Error('First argument to fold is not a function');
  }
  if (!Array.isArray(a)) {
    throw new Error('Second argument to fold is not an array');
  }
  return a.reduce(function (acc, x, i) {
    return f(acc, x, i);
  }, init);
}

function arrayFilter(f, a) {
  if (typeof f !== 'function') {
    throw new Error('First argument to filter is not a function');
  }
  if (!Array.isArray(a)) {
    throw new Error('Second argument to filter is not an array');
  }
  return a.filter(function (x, i) {
    return f(x, i);
  });
}

function stringOrArrayIndexOf(target, s) {
  if (!(Array.isArray(s) || typeof s === 'string')) {
    throw new Error('Second argument to indexOf is not a string or array');
  }

  return s.indexOf(target);
}

function arrayJoin(sep, a) {
  if (!Array.isArray(a)) {
    throw new Error('Second argument to join is not an array');
  }

  return a.join(sep);
}

function sign(x) {
  return ((x > 0) - (x < 0)) || +x;
}

var ONE_THIRD = 1/3;
function cbrt(x) {
  return x < 0 ? -Math.pow(-x, ONE_THIRD) : Math.pow(x, ONE_THIRD);
}

function expm1(x) {
  return Math.exp(x) - 1;
}

function log1p(x) {
  return Math.log(1 + x);
}

function log2(x) {
  return Math.log(x) / Math.LN2;
}

function Parser$1(options) {
  this.options = options || {};
  this.unaryOps = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sinh: Math.sinh || sinh,
    cosh: Math.cosh || cosh,
    tanh: Math.tanh || tanh,
    asinh: Math.asinh || asinh,
    acosh: Math.acosh || acosh,
    atanh: Math.atanh || atanh,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt || cbrt,
    log: Math.log,
    log2: Math.log2 || log2,
    ln: Math.log,
    lg: Math.log10 || log10,
    log10: Math.log10 || log10,
    expm1: Math.expm1 || expm1,
    log1p: Math.log1p || log1p,
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    trunc: Math.trunc || trunc,
    '-': neg,
    '+': Number,
    exp: Math.exp,
    not: not,
    length: stringOrArrayLength,
    '!': factorial,
    sign: Math.sign || sign
  };

  this.binaryOps = {
    '+': add,
    '-': sub,
    '*': mul,
    '/': div,
    '%': mod,
    '^': Math.pow,
    '||': concat,
    '==': equal,
    '!=': notEqual,
    '>': greaterThan,
    '<': lessThan,
    '>=': greaterThanEqual,
    '<=': lessThanEqual,
    and: andOperator,
    or: orOperator,
    'in': inOperator,
    '=': setVar,
    '[': arrayIndex
  };

  this.ternaryOps = {
    '?': condition
  };

  this.functions = {
    random: random,
    fac: factorial,
    min: min,
    max: max,
    hypot: Math.hypot || hypot,
    pyt: Math.hypot || hypot, // backward compat
    pow: Math.pow,
    atan2: Math.atan2,
    'if': condition,
    gamma: gamma,
    roundTo: roundTo,
    map: arrayMap,
    fold: arrayFold,
    filter: arrayFilter,
    indexOf: stringOrArrayIndexOf,
    join: arrayJoin
  };

  this.consts = {
    E: Math.E,
    PI: Math.PI,
    'true': true,
    'false': false
  };
}

Parser$1.prototype.parse = function (expr) {
  var instr = [];
  var parserState = new ParserState(
    this,
    new TokenStream(this, expr),
    { allowMemberAccess: this.options.allowMemberAccess }
  );

  parserState.parseExpression(instr);
  parserState.expect(TEOF, 'EOF');

  return new Expression(instr, this);
};

Parser$1.prototype.evaluate = function (expr, variables) {
  return this.parse(expr).evaluate(variables);
};

var sharedParser = new Parser$1();

Parser$1.parse = function (expr) {
  return sharedParser.parse(expr);
};

Parser$1.evaluate = function (expr, variables) {
  return sharedParser.parse(expr).evaluate(variables);
};

var optionNameMap = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '%': 'remainder',
  '^': 'power',
  '!': 'factorial',
  '<': 'comparison',
  '>': 'comparison',
  '<=': 'comparison',
  '>=': 'comparison',
  '==': 'comparison',
  '!=': 'comparison',
  '||': 'concatenate',
  'and': 'logical',
  'or': 'logical',
  'not': 'logical',
  '?': 'conditional',
  ':': 'conditional',
  '=': 'assignment',
  '[': 'array',
  '()=': 'fndef'
};

function getOptionName(op) {
  return optionNameMap.hasOwnProperty(op) ? optionNameMap[op] : op;
}

Parser$1.prototype.isOperatorEnabled = function (op) {
  var optionName = getOptionName(op);
  var operators = this.options.operators || {};

  return !(optionName in operators) || !!operators[optionName];
};

/*!
 Based on ndef.parser, by Raphael Graf(r@undefined.ch)
 http://www.undefined.ch/mparser/index.html

 Ported to JavaScript and modified by Matthew Crumley (email@matthewcrumley.com, http://silentmatt.com/)

 You are free to use and modify this code in anyway you find useful. Please leave this comment in the code
 to acknowledge its original source. If you feel like it, I enjoy hearing about projects that use my code,
 but don't feel like you have to let me know or ask permission.
*/

// Backwards compatibility
var index = {
  Parser: Parser$1,
  Expression: Expression
};

var dist = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': index,
    Expression: Expression,
    Parser: Parser$1
});

function getAugmentedNamespace(n) {
	if (n.__esModule) return n;
	var a = Object.defineProperty({}, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var require$$0 = /*@__PURE__*/getAugmentedNamespace(dist);

function _isPlaceholder(a) {
  return a != null && typeof a === 'object' && a['@@functional/placeholder'] === true;
}

/**
 * Optimized internal one-arity curry function.
 *
 * @private
 * @category Function
 * @param {Function} fn The function to curry.
 * @return {Function} The curried function.
 */

function _curry1(fn) {
  return function f1(a) {
    if (arguments.length === 0 || _isPlaceholder(a)) {
      return f1;
    } else {
      return fn.apply(this, arguments);
    }
  };
}

/**
 * Optimized internal two-arity curry function.
 *
 * @private
 * @category Function
 * @param {Function} fn The function to curry.
 * @return {Function} The curried function.
 */

function _curry2(fn) {
  return function f2(a, b) {
    switch (arguments.length) {
      case 0:
        return f2;

      case 1:
        return _isPlaceholder(a) ? f2 : _curry1(function (_b) {
          return fn(a, _b);
        });

      default:
        return _isPlaceholder(a) && _isPlaceholder(b) ? f2 : _isPlaceholder(a) ? _curry1(function (_a) {
          return fn(_a, b);
        }) : _isPlaceholder(b) ? _curry1(function (_b) {
          return fn(a, _b);
        }) : fn(a, b);
    }
  };
}

function _arity(n, fn) {
  /* eslint-disable no-unused-vars */
  switch (n) {
    case 0:
      return function () {
        return fn.apply(this, arguments);
      };

    case 1:
      return function (a0) {
        return fn.apply(this, arguments);
      };

    case 2:
      return function (a0, a1) {
        return fn.apply(this, arguments);
      };

    case 3:
      return function (a0, a1, a2) {
        return fn.apply(this, arguments);
      };

    case 4:
      return function (a0, a1, a2, a3) {
        return fn.apply(this, arguments);
      };

    case 5:
      return function (a0, a1, a2, a3, a4) {
        return fn.apply(this, arguments);
      };

    case 6:
      return function (a0, a1, a2, a3, a4, a5) {
        return fn.apply(this, arguments);
      };

    case 7:
      return function (a0, a1, a2, a3, a4, a5, a6) {
        return fn.apply(this, arguments);
      };

    case 8:
      return function (a0, a1, a2, a3, a4, a5, a6, a7) {
        return fn.apply(this, arguments);
      };

    case 9:
      return function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
        return fn.apply(this, arguments);
      };

    case 10:
      return function (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
        return fn.apply(this, arguments);
      };

    default:
      throw new Error('First argument to _arity must be a non-negative integer no greater than ten');
  }
}

/**
 * Internal curryN function.
 *
 * @private
 * @category Function
 * @param {Number} length The arity of the curried function.
 * @param {Array} received An array of arguments received thus far.
 * @param {Function} fn The function to curry.
 * @return {Function} The curried function.
 */

function _curryN(length, received, fn) {
  return function () {
    var combined = [];
    var argsIdx = 0;
    var left = length;
    var combinedIdx = 0;

    while (combinedIdx < received.length || argsIdx < arguments.length) {
      var result;

      if (combinedIdx < received.length && (!_isPlaceholder(received[combinedIdx]) || argsIdx >= arguments.length)) {
        result = received[combinedIdx];
      } else {
        result = arguments[argsIdx];
        argsIdx += 1;
      }

      combined[combinedIdx] = result;

      if (!_isPlaceholder(result)) {
        left -= 1;
      }

      combinedIdx += 1;
    }

    return left <= 0 ? fn.apply(this, combined) : _arity(left, _curryN(length, combined, fn));
  };
}

/**
 * Returns a curried equivalent of the provided function, with the specified
 * arity. The curried function has two unusual capabilities. First, its
 * arguments needn't be provided one at a time. If `g` is `R.curryN(3, f)`, the
 * following are equivalent:
 *
 *   - `g(1)(2)(3)`
 *   - `g(1)(2, 3)`
 *   - `g(1, 2)(3)`
 *   - `g(1, 2, 3)`
 *
 * Secondly, the special placeholder value [`R.__`](#__) may be used to specify
 * "gaps", allowing partial application of any combination of arguments,
 * regardless of their positions. If `g` is as above and `_` is [`R.__`](#__),
 * the following are equivalent:
 *
 *   - `g(1, 2, 3)`
 *   - `g(_, 2, 3)(1)`
 *   - `g(_, _, 3)(1)(2)`
 *   - `g(_, _, 3)(1, 2)`
 *   - `g(_, 2)(1)(3)`
 *   - `g(_, 2)(1, 3)`
 *   - `g(_, 2)(_, 3)(1)`
 *
 * @func
 * @memberOf R
 * @since v0.5.0
 * @category Function
 * @sig Number -> (* -> a) -> (* -> a)
 * @param {Number} length The arity for the returned function.
 * @param {Function} fn The function to curry.
 * @return {Function} A new, curried function.
 * @see R.curry
 * @example
 *
 *      const sumArgs = (...args) => R.sum(args);
 *
 *      const curriedAddFourNumbers = R.curryN(4, sumArgs);
 *      const f = curriedAddFourNumbers(1, 2);
 *      const g = f(3);
 *      g(4); //=> 10
 */

var curryN =
/*#__PURE__*/
_curry2(function curryN(length, fn) {
  if (length === 1) {
    return _curry1(fn);
  }

  return _arity(length, _curryN(length, [], fn));
});

var curryN$1 = curryN;

/**
 * Optimized internal three-arity curry function.
 *
 * @private
 * @category Function
 * @param {Function} fn The function to curry.
 * @return {Function} The curried function.
 */

function _curry3(fn) {
  return function f3(a, b, c) {
    switch (arguments.length) {
      case 0:
        return f3;

      case 1:
        return _isPlaceholder(a) ? f3 : _curry2(function (_b, _c) {
          return fn(a, _b, _c);
        });

      case 2:
        return _isPlaceholder(a) && _isPlaceholder(b) ? f3 : _isPlaceholder(a) ? _curry2(function (_a, _c) {
          return fn(_a, b, _c);
        }) : _isPlaceholder(b) ? _curry2(function (_b, _c) {
          return fn(a, _b, _c);
        }) : _curry1(function (_c) {
          return fn(a, b, _c);
        });

      default:
        return _isPlaceholder(a) && _isPlaceholder(b) && _isPlaceholder(c) ? f3 : _isPlaceholder(a) && _isPlaceholder(b) ? _curry2(function (_a, _b) {
          return fn(_a, _b, c);
        }) : _isPlaceholder(a) && _isPlaceholder(c) ? _curry2(function (_a, _c) {
          return fn(_a, b, _c);
        }) : _isPlaceholder(b) && _isPlaceholder(c) ? _curry2(function (_b, _c) {
          return fn(a, _b, _c);
        }) : _isPlaceholder(a) ? _curry1(function (_a) {
          return fn(_a, b, c);
        }) : _isPlaceholder(b) ? _curry1(function (_b) {
          return fn(a, _b, c);
        }) : _isPlaceholder(c) ? _curry1(function (_c) {
          return fn(a, b, _c);
        }) : fn(a, b, c);
    }
  };
}

/**
 * Tests whether or not an object is an array.
 *
 * @private
 * @param {*} val The object to test.
 * @return {Boolean} `true` if `val` is an array, `false` otherwise.
 * @example
 *
 *      _isArray([]); //=> true
 *      _isArray(null); //=> false
 *      _isArray({}); //=> false
 */
var _isArray = Array.isArray || function _isArray(val) {
  return val != null && val.length >= 0 && Object.prototype.toString.call(val) === '[object Array]';
};

function _isTransformer(obj) {
  return obj != null && typeof obj['@@transducer/step'] === 'function';
}

/**
 * Returns a function that dispatches with different strategies based on the
 * object in list position (last argument). If it is an array, executes [fn].
 * Otherwise, if it has a function with one of the given method names, it will
 * execute that function (functor case). Otherwise, if it is a transformer,
 * uses transducer [xf] to return a new transformer (transducer case).
 * Otherwise, it will default to executing [fn].
 *
 * @private
 * @param {Array} methodNames properties to check for a custom implementation
 * @param {Function} xf transducer to initialize if object is transformer
 * @param {Function} fn default ramda implementation
 * @return {Function} A function that dispatches on object in list position
 */

function _dispatchable(methodNames, xf, fn) {
  return function () {
    if (arguments.length === 0) {
      return fn();
    }

    var args = Array.prototype.slice.call(arguments, 0);
    var obj = args.pop();

    if (!_isArray(obj)) {
      var idx = 0;

      while (idx < methodNames.length) {
        if (typeof obj[methodNames[idx]] === 'function') {
          return obj[methodNames[idx]].apply(obj, args);
        }

        idx += 1;
      }

      if (_isTransformer(obj)) {
        var transducer = xf.apply(null, args);
        return transducer(obj);
      }
    }

    return fn.apply(this, arguments);
  };
}

function _reduced(x) {
  return x && x['@@transducer/reduced'] ? x : {
    '@@transducer/value': x,
    '@@transducer/reduced': true
  };
}

var _xfBase = {
  init: function () {
    return this.xf['@@transducer/init']();
  },
  result: function (result) {
    return this.xf['@@transducer/result'](result);
  }
};

function _map(fn, functor) {
  var idx = 0;
  var len = functor.length;
  var result = Array(len);

  while (idx < len) {
    result[idx] = fn(functor[idx]);
    idx += 1;
  }

  return result;
}

function _isString(x) {
  return Object.prototype.toString.call(x) === '[object String]';
}

/**
 * Tests whether or not an object is similar to an array.
 *
 * @private
 * @category Type
 * @category List
 * @sig * -> Boolean
 * @param {*} x The object to test.
 * @return {Boolean} `true` if `x` has a numeric length property and extreme indices defined; `false` otherwise.
 * @example
 *
 *      _isArrayLike([]); //=> true
 *      _isArrayLike(true); //=> false
 *      _isArrayLike({}); //=> false
 *      _isArrayLike({length: 10}); //=> false
 *      _isArrayLike({0: 'zero', 9: 'nine', length: 10}); //=> true
 */

var _isArrayLike =
/*#__PURE__*/
_curry1(function isArrayLike(x) {
  if (_isArray(x)) {
    return true;
  }

  if (!x) {
    return false;
  }

  if (typeof x !== 'object') {
    return false;
  }

  if (_isString(x)) {
    return false;
  }

  if (x.nodeType === 1) {
    return !!x.length;
  }

  if (x.length === 0) {
    return true;
  }

  if (x.length > 0) {
    return x.hasOwnProperty(0) && x.hasOwnProperty(x.length - 1);
  }

  return false;
});

var _isArrayLike$1 = _isArrayLike;

var XWrap =
/*#__PURE__*/
function () {
  function XWrap(fn) {
    this.f = fn;
  }

  XWrap.prototype['@@transducer/init'] = function () {
    throw new Error('init not implemented on XWrap');
  };

  XWrap.prototype['@@transducer/result'] = function (acc) {
    return acc;
  };

  XWrap.prototype['@@transducer/step'] = function (acc, x) {
    return this.f(acc, x);
  };

  return XWrap;
}();

function _xwrap(fn) {
  return new XWrap(fn);
}

/**
 * Creates a function that is bound to a context.
 * Note: `R.bind` does not provide the additional argument-binding capabilities of
 * [Function.prototype.bind](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind).
 *
 * @func
 * @memberOf R
 * @since v0.6.0
 * @category Function
 * @category Object
 * @sig (* -> *) -> {*} -> (* -> *)
 * @param {Function} fn The function to bind to context
 * @param {Object} thisObj The context to bind `fn` to
 * @return {Function} A function that will execute in the context of `thisObj`.
 * @see R.partial
 * @example
 *
 *      const log = R.bind(console.log, console);
 *      R.pipe(R.assoc('a', 2), R.tap(log), R.assoc('a', 3))({a: 1}); //=> {a: 3}
 *      // logs {a: 2}
 * @symb R.bind(f, o)(a, b) = f.call(o, a, b)
 */

var bind =
/*#__PURE__*/
_curry2(function bind(fn, thisObj) {
  return _arity(fn.length, function () {
    return fn.apply(thisObj, arguments);
  });
});

var bind$1 = bind;

function _arrayReduce(xf, acc, list) {
  var idx = 0;
  var len = list.length;

  while (idx < len) {
    acc = xf['@@transducer/step'](acc, list[idx]);

    if (acc && acc['@@transducer/reduced']) {
      acc = acc['@@transducer/value'];
      break;
    }

    idx += 1;
  }

  return xf['@@transducer/result'](acc);
}

function _iterableReduce(xf, acc, iter) {
  var step = iter.next();

  while (!step.done) {
    acc = xf['@@transducer/step'](acc, step.value);

    if (acc && acc['@@transducer/reduced']) {
      acc = acc['@@transducer/value'];
      break;
    }

    step = iter.next();
  }

  return xf['@@transducer/result'](acc);
}

function _methodReduce(xf, acc, obj, methodName) {
  return xf['@@transducer/result'](obj[methodName](bind$1(xf['@@transducer/step'], xf), acc));
}

var symIterator = typeof Symbol !== 'undefined' ? Symbol.iterator : '@@iterator';
function _reduce(fn, acc, list) {
  if (typeof fn === 'function') {
    fn = _xwrap(fn);
  }

  if (_isArrayLike$1(list)) {
    return _arrayReduce(fn, acc, list);
  }

  if (typeof list['fantasy-land/reduce'] === 'function') {
    return _methodReduce(fn, acc, list, 'fantasy-land/reduce');
  }

  if (list[symIterator] != null) {
    return _iterableReduce(fn, acc, list[symIterator]());
  }

  if (typeof list.next === 'function') {
    return _iterableReduce(fn, acc, list);
  }

  if (typeof list.reduce === 'function') {
    return _methodReduce(fn, acc, list, 'reduce');
  }

  throw new TypeError('reduce: list must be array or iterable');
}

var XMap =
/*#__PURE__*/
function () {
  function XMap(f, xf) {
    this.xf = xf;
    this.f = f;
  }

  XMap.prototype['@@transducer/init'] = _xfBase.init;
  XMap.prototype['@@transducer/result'] = _xfBase.result;

  XMap.prototype['@@transducer/step'] = function (result, input) {
    return this.xf['@@transducer/step'](result, this.f(input));
  };

  return XMap;
}();

var _xmap =
/*#__PURE__*/
_curry2(function _xmap(f, xf) {
  return new XMap(f, xf);
});

var _xmap$1 = _xmap;

function _has(prop, obj) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

var toString = Object.prototype.toString;

var _isArguments =
/*#__PURE__*/
function () {
  return toString.call(arguments) === '[object Arguments]' ? function _isArguments(x) {
    return toString.call(x) === '[object Arguments]';
  } : function _isArguments(x) {
    return _has('callee', x);
  };
}();

var _isArguments$1 = _isArguments;

var hasEnumBug = !
/*#__PURE__*/
{
  toString: null
}.propertyIsEnumerable('toString');
var nonEnumerableProps = ['constructor', 'valueOf', 'isPrototypeOf', 'toString', 'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString']; // Safari bug

var hasArgsEnumBug =
/*#__PURE__*/
function () {

  return arguments.propertyIsEnumerable('length');
}();

var contains = function contains(list, item) {
  var idx = 0;

  while (idx < list.length) {
    if (list[idx] === item) {
      return true;
    }

    idx += 1;
  }

  return false;
};
/**
 * Returns a list containing the names of all the enumerable own properties of
 * the supplied object.
 * Note that the order of the output array is not guaranteed to be consistent
 * across different JS platforms.
 *
 * @func
 * @memberOf R
 * @since v0.1.0
 * @category Object
 * @sig {k: v} -> [k]
 * @param {Object} obj The object to extract properties from
 * @return {Array} An array of the object's own properties.
 * @see R.keysIn, R.values
 * @example
 *
 *      R.keys({a: 1, b: 2, c: 3}); //=> ['a', 'b', 'c']
 */


var keys = typeof Object.keys === 'function' && !hasArgsEnumBug ?
/*#__PURE__*/
_curry1(function keys(obj) {
  return Object(obj) !== obj ? [] : Object.keys(obj);
}) :
/*#__PURE__*/
_curry1(function keys(obj) {
  if (Object(obj) !== obj) {
    return [];
  }

  var prop, nIdx;
  var ks = [];

  var checkArgsLength = hasArgsEnumBug && _isArguments$1(obj);

  for (prop in obj) {
    if (_has(prop, obj) && (!checkArgsLength || prop !== 'length')) {
      ks[ks.length] = prop;
    }
  }

  if (hasEnumBug) {
    nIdx = nonEnumerableProps.length - 1;

    while (nIdx >= 0) {
      prop = nonEnumerableProps[nIdx];

      if (_has(prop, obj) && !contains(ks, prop)) {
        ks[ks.length] = prop;
      }

      nIdx -= 1;
    }
  }

  return ks;
});
var keys$1 = keys;

/**
 * Takes a function and
 * a [functor](https://github.com/fantasyland/fantasy-land#functor),
 * applies the function to each of the functor's values, and returns
 * a functor of the same shape.
 *
 * Ramda provides suitable `map` implementations for `Array` and `Object`,
 * so this function may be applied to `[1, 2, 3]` or `{x: 1, y: 2, z: 3}`.
 *
 * Dispatches to the `map` method of the second argument, if present.
 *
 * Acts as a transducer if a transformer is given in list position.
 *
 * Also treats functions as functors and will compose them together.
 *
 * @func
 * @memberOf R
 * @since v0.1.0
 * @category List
 * @sig Functor f => (a -> b) -> f a -> f b
 * @param {Function} fn The function to be called on every element of the input `list`.
 * @param {Array} list The list to be iterated over.
 * @return {Array} The new list.
 * @see R.transduce, R.addIndex
 * @example
 *
 *      const double = x => x * 2;
 *
 *      R.map(double, [1, 2, 3]); //=> [2, 4, 6]
 *
 *      R.map(double, {x: 1, y: 2, z: 3}); //=> {x: 2, y: 4, z: 6}
 * @symb R.map(f, [a, b]) = [f(a), f(b)]
 * @symb R.map(f, { x: a, y: b }) = { x: f(a), y: f(b) }
 * @symb R.map(f, functor_o) = functor_o.map(f)
 */

var map =
/*#__PURE__*/
_curry2(
/*#__PURE__*/
_dispatchable(['fantasy-land/map', 'map'], _xmap$1, function map(fn, functor) {
  switch (Object.prototype.toString.call(functor)) {
    case '[object Function]':
      return curryN$1(functor.length, function () {
        return fn.call(this, functor.apply(this, arguments));
      });

    case '[object Object]':
      return _reduce(function (acc, key) {
        acc[key] = fn(functor[key]);
        return acc;
      }, {}, keys$1(functor));

    default:
      return _map(fn, functor);
  }
}));

var map$1 = map;

/**
 * Determine if the passed argument is an integer.
 *
 * @private
 * @param {*} n
 * @category Type
 * @return {Boolean}
 */
var _isInteger = Number.isInteger || function _isInteger(n) {
  return n << 0 === n;
};

/**
 * Returns the nth element of the given list or string. If n is negative the
 * element at index length + n is returned.
 *
 * @func
 * @memberOf R
 * @since v0.1.0
 * @category List
 * @sig Number -> [a] -> a | Undefined
 * @sig Number -> String -> String
 * @param {Number} offset
 * @param {*} list
 * @return {*}
 * @example
 *
 *      const list = ['foo', 'bar', 'baz', 'quux'];
 *      R.nth(1, list); //=> 'bar'
 *      R.nth(-1, list); //=> 'quux'
 *      R.nth(-99, list); //=> undefined
 *
 *      R.nth(2, 'abc'); //=> 'c'
 *      R.nth(3, 'abc'); //=> ''
 * @symb R.nth(-1, [a, b, c]) = c
 * @symb R.nth(0, [a, b, c]) = a
 * @symb R.nth(1, [a, b, c]) = b
 */

var nth =
/*#__PURE__*/
_curry2(function nth(offset, list) {
  var idx = offset < 0 ? list.length + offset : offset;
  return _isString(list) ? list.charAt(idx) : list[idx];
});

var nth$1 = nth;

/**
 * Retrieves the values at given paths of an object.
 *
 * @func
 * @memberOf R
 * @since v0.27.1
 * @category Object
 * @typedefn Idx = [String | Int]
 * @sig [Idx] -> {a} -> [a | Undefined]
 * @param {Array} pathsArray The array of paths to be fetched.
 * @param {Object} obj The object to retrieve the nested properties from.
 * @return {Array} A list consisting of values at paths specified by "pathsArray".
 * @see R.path
 * @example
 *
 *      R.paths([['a', 'b'], ['p', 0, 'q']], {a: {b: 2}, p: [{q: 3}]}); //=> [2, 3]
 *      R.paths([['a', 'b'], ['p', 'r']], {a: {b: 2}, p: [{q: 3}]}); //=> [2, undefined]
 */

var paths =
/*#__PURE__*/
_curry2(function paths(pathsArray, obj) {
  return pathsArray.map(function (paths) {
    var val = obj;
    var idx = 0;
    var p;

    while (idx < paths.length) {
      if (val == null) {
        return;
      }

      p = paths[idx];
      val = _isInteger(p) ? nth$1(p, val) : val[p];
      idx += 1;
    }

    return val;
  });
});

var paths$1 = paths;

/**
 * Retrieve the value at a given path.
 *
 * @func
 * @memberOf R
 * @since v0.2.0
 * @category Object
 * @typedefn Idx = String | Int
 * @sig [Idx] -> {a} -> a | Undefined
 * @param {Array} path The path to use.
 * @param {Object} obj The object to retrieve the nested property from.
 * @return {*} The data at `path`.
 * @see R.prop, R.nth
 * @example
 *
 *      R.path(['a', 'b'], {a: {b: 2}}); //=> 2
 *      R.path(['a', 'b'], {c: {b: 2}}); //=> undefined
 *      R.path(['a', 'b', 0], {a: {b: [1, 2, 3]}}); //=> 1
 *      R.path(['a', 'b', -2], {a: {b: [1, 2, 3]}}); //=> 2
 */

var path =
/*#__PURE__*/
_curry2(function path(pathAr, obj) {
  return paths$1([pathAr], obj)[0];
});

var path$1 = path;

/**
 * Returns a function that when supplied an object returns the indicated
 * property of that object, if it exists.
 *
 * @func
 * @memberOf R
 * @since v0.1.0
 * @category Object
 * @typedefn Idx = String | Int
 * @sig Idx -> {s: a} -> a | Undefined
 * @param {String|Number} p The property name or array index
 * @param {Object} obj The object to query
 * @return {*} The value at `obj.p`.
 * @see R.path, R.nth
 * @example
 *
 *      R.prop('x', {x: 100}); //=> 100
 *      R.prop('x', {}); //=> undefined
 *      R.prop(0, [100]); //=> 100
 *      R.compose(R.inc, R.prop('x'))({ x: 3 }) //=> 4
 */

var prop =
/*#__PURE__*/
_curry2(function prop(p, obj) {
  return path$1([p], obj);
});

var prop$1 = prop;

/**
 * Makes a shallow clone of an object, setting or overriding the specified
 * property with the given value. Note that this copies and flattens prototype
 * properties onto the new object as well. All non-primitive properties are
 * copied by reference.
 *
 * @func
 * @memberOf R
 * @since v0.8.0
 * @category Object
 * @sig String -> a -> {k: v} -> {k: v}
 * @param {String} prop The property name to set
 * @param {*} val The new value
 * @param {Object} obj The object to clone
 * @return {Object} A new object equivalent to the original except for the changed property.
 * @see R.dissoc, R.pick
 * @example
 *
 *      R.assoc('c', 3, {a: 1, b: 2}); //=> {a: 1, b: 2, c: 3}
 */

var assoc =
/*#__PURE__*/
_curry3(function assoc(prop, val, obj) {
  var result = {};

  for (var p in obj) {
    result[p] = obj[p];
  }

  result[prop] = val;
  return result;
});

var assoc$1 = assoc;

/**
 * Checks if the input value is `null` or `undefined`.
 *
 * @func
 * @memberOf R
 * @since v0.9.0
 * @category Type
 * @sig * -> Boolean
 * @param {*} x The value to test.
 * @return {Boolean} `true` if `x` is `undefined` or `null`, otherwise `false`.
 * @example
 *
 *      R.isNil(null); //=> true
 *      R.isNil(undefined); //=> true
 *      R.isNil(0); //=> false
 *      R.isNil([]); //=> false
 */

var isNil =
/*#__PURE__*/
_curry1(function isNil(x) {
  return x == null;
});

var isNil$1 = isNil;

/**
 * Makes a shallow clone of an object, setting or overriding the nodes required
 * to create the given path, and placing the specific value at the tail end of
 * that path. Note that this copies and flattens prototype properties onto the
 * new object as well. All non-primitive properties are copied by reference.
 *
 * @func
 * @memberOf R
 * @since v0.8.0
 * @category Object
 * @typedefn Idx = String | Int
 * @sig [Idx] -> a -> {a} -> {a}
 * @param {Array} path the path to set
 * @param {*} val The new value
 * @param {Object} obj The object to clone
 * @return {Object} A new object equivalent to the original except along the specified path.
 * @see R.dissocPath
 * @example
 *
 *      R.assocPath(['a', 'b', 'c'], 42, {a: {b: {c: 0}}}); //=> {a: {b: {c: 42}}}
 *
 *      // Any missing or non-object keys in path will be overridden
 *      R.assocPath(['a', 'b', 'c'], 42, {a: 5}); //=> {a: {b: {c: 42}}}
 */

var assocPath =
/*#__PURE__*/
_curry3(function assocPath(path, val, obj) {
  if (path.length === 0) {
    return val;
  }

  var idx = path[0];

  if (path.length > 1) {
    var nextObj = !isNil$1(obj) && _has(idx, obj) ? obj[idx] : _isInteger(path[1]) ? [] : {};
    val = assocPath(Array.prototype.slice.call(path, 1), val, nextObj);
  }

  if (_isInteger(idx) && _isArray(obj)) {
    var arr = [].concat(obj);
    arr[idx] = val;
    return arr;
  } else {
    return assoc$1(idx, val, obj);
  }
});

var assocPath$1 = assocPath;

function _cloneRegExp(pattern) {
  return new RegExp(pattern.source, (pattern.global ? 'g' : '') + (pattern.ignoreCase ? 'i' : '') + (pattern.multiline ? 'm' : '') + (pattern.sticky ? 'y' : '') + (pattern.unicode ? 'u' : ''));
}

/**
 * Gives a single-word string description of the (native) type of a value,
 * returning such answers as 'Object', 'Number', 'Array', or 'Null'. Does not
 * attempt to distinguish user Object types any further, reporting them all as
 * 'Object'.
 *
 * @func
 * @memberOf R
 * @since v0.8.0
 * @category Type
 * @sig (* -> {*}) -> String
 * @param {*} val The value to test
 * @return {String}
 * @example
 *
 *      R.type({}); //=> "Object"
 *      R.type(1); //=> "Number"
 *      R.type(false); //=> "Boolean"
 *      R.type('s'); //=> "String"
 *      R.type(null); //=> "Null"
 *      R.type([]); //=> "Array"
 *      R.type(/[A-z]/); //=> "RegExp"
 *      R.type(() => {}); //=> "Function"
 *      R.type(undefined); //=> "Undefined"
 */

var type =
/*#__PURE__*/
_curry1(function type(val) {
  return val === null ? 'Null' : val === undefined ? 'Undefined' : Object.prototype.toString.call(val).slice(8, -1);
});

var type$1 = type;

/**
 * Copies an object.
 *
 * @private
 * @param {*} value The value to be copied
 * @param {Array} refFrom Array containing the source references
 * @param {Array} refTo Array containing the copied source references
 * @param {Boolean} deep Whether or not to perform deep cloning.
 * @return {*} The copied value.
 */

function _clone(value, refFrom, refTo, deep) {
  var copy = function copy(copiedValue) {
    var len = refFrom.length;
    var idx = 0;

    while (idx < len) {
      if (value === refFrom[idx]) {
        return refTo[idx];
      }

      idx += 1;
    }

    refFrom[idx + 1] = value;
    refTo[idx + 1] = copiedValue;

    for (var key in value) {
      copiedValue[key] = deep ? _clone(value[key], refFrom, refTo, true) : value[key];
    }

    return copiedValue;
  };

  switch (type$1(value)) {
    case 'Object':
      return copy({});

    case 'Array':
      return copy([]);

    case 'Date':
      return new Date(value.valueOf());

    case 'RegExp':
      return _cloneRegExp(value);

    default:
      return value;
  }
}

/**
 * Creates a deep copy of the value which may contain (nested) `Array`s and
 * `Object`s, `Number`s, `String`s, `Boolean`s and `Date`s. `Function`s are
 * assigned by reference rather than copied
 *
 * Dispatches to a `clone` method if present.
 *
 * @func
 * @memberOf R
 * @since v0.1.0
 * @category Object
 * @sig {*} -> {*}
 * @param {*} value The object or array to clone
 * @return {*} A deeply cloned copy of `val`
 * @example
 *
 *      const objects = [{}, {}, {}];
 *      const objectsClone = R.clone(objects);
 *      objects === objectsClone; //=> false
 *      objects[0] === objectsClone[0]; //=> false
 */

var clone =
/*#__PURE__*/
_curry1(function clone(value) {
  return value != null && typeof value.clone === 'function' ? value.clone() : _clone(value, [], [], true);
});

var clone$1 = clone;

/**
 * This checks whether a function has a [methodname] function. If it isn't an
 * array it will execute that function otherwise it will default to the ramda
 * implementation.
 *
 * @private
 * @param {Function} fn ramda implemtation
 * @param {String} methodname property to check for a custom implementation
 * @return {Object} Whatever the return value of the method is.
 */

function _checkForMethod(methodname, fn) {
  return function () {
    var length = arguments.length;

    if (length === 0) {
      return fn();
    }

    var obj = arguments[length - 1];
    return _isArray(obj) || typeof obj[methodname] !== 'function' ? fn.apply(this, arguments) : obj[methodname].apply(obj, Array.prototype.slice.call(arguments, 0, length - 1));
  };
}

/**
 * Returns the elements of the given list or string (or object with a `slice`
 * method) from `fromIndex` (inclusive) to `toIndex` (exclusive).
 *
 * Dispatches to the `slice` method of the third argument, if present.
 *
 * @func
 * @memberOf R
 * @since v0.1.4
 * @category List
 * @sig Number -> Number -> [a] -> [a]
 * @sig Number -> Number -> String -> String
 * @param {Number} fromIndex The start index (inclusive).
 * @param {Number} toIndex The end index (exclusive).
 * @param {*} list
 * @return {*}
 * @example
 *
 *      R.slice(1, 3, ['a', 'b', 'c', 'd']);        //=> ['b', 'c']
 *      R.slice(1, Infinity, ['a', 'b', 'c', 'd']); //=> ['b', 'c', 'd']
 *      R.slice(0, -1, ['a', 'b', 'c', 'd']);       //=> ['a', 'b', 'c']
 *      R.slice(-3, -1, ['a', 'b', 'c', 'd']);      //=> ['b', 'c']
 *      R.slice(0, 3, 'ramda');                     //=> 'ram'
 */

var slice =
/*#__PURE__*/
_curry3(
/*#__PURE__*/
_checkForMethod('slice', function slice(fromIndex, toIndex, list) {
  return Array.prototype.slice.call(list, fromIndex, toIndex);
}));

var slice$1 = slice;

var XTake =
/*#__PURE__*/
function () {
  function XTake(n, xf) {
    this.xf = xf;
    this.n = n;
    this.i = 0;
  }

  XTake.prototype['@@transducer/init'] = _xfBase.init;
  XTake.prototype['@@transducer/result'] = _xfBase.result;

  XTake.prototype['@@transducer/step'] = function (result, input) {
    this.i += 1;
    var ret = this.n === 0 ? result : this.xf['@@transducer/step'](result, input);
    return this.n >= 0 && this.i >= this.n ? _reduced(ret) : ret;
  };

  return XTake;
}();

var _xtake =
/*#__PURE__*/
_curry2(function _xtake(n, xf) {
  return new XTake(n, xf);
});

var _xtake$1 = _xtake;

/**
 * Returns the first `n` elements of the given list, string, or
 * transducer/transformer (or object with a `take` method).
 *
 * Dispatches to the `take` method of the second argument, if present.
 *
 * @func
 * @memberOf R
 * @since v0.1.0
 * @category List
 * @sig Number -> [a] -> [a]
 * @sig Number -> String -> String
 * @param {Number} n
 * @param {*} list
 * @return {*}
 * @see R.drop
 * @example
 *
 *      R.take(1, ['foo', 'bar', 'baz']); //=> ['foo']
 *      R.take(2, ['foo', 'bar', 'baz']); //=> ['foo', 'bar']
 *      R.take(3, ['foo', 'bar', 'baz']); //=> ['foo', 'bar', 'baz']
 *      R.take(4, ['foo', 'bar', 'baz']); //=> ['foo', 'bar', 'baz']
 *      R.take(3, 'ramda');               //=> 'ram'
 *
 *      const personnel = [
 *        'Dave Brubeck',
 *        'Paul Desmond',
 *        'Eugene Wright',
 *        'Joe Morello',
 *        'Gerry Mulligan',
 *        'Bob Bates',
 *        'Joe Dodge',
 *        'Ron Crotty'
 *      ];
 *
 *      const takeFive = R.take(5);
 *      takeFive(personnel);
 *      //=> ['Dave Brubeck', 'Paul Desmond', 'Eugene Wright', 'Joe Morello', 'Gerry Mulligan']
 * @symb R.take(-1, [a, b]) = [a, b]
 * @symb R.take(0, [a, b]) = []
 * @symb R.take(1, [a, b]) = [a]
 * @symb R.take(2, [a, b]) = [a, b]
 */

var take =
/*#__PURE__*/
_curry2(
/*#__PURE__*/
_dispatchable(['take'], _xtake$1, function take(n, xs) {
  return slice$1(0, n < 0 ? Infinity : n, xs);
}));

var take$1 = take;

function dropLast$2(n, xs) {
  return take$1(n < xs.length ? xs.length - n : 0, xs);
}

var XDropLast =
/*#__PURE__*/
function () {
  function XDropLast(n, xf) {
    this.xf = xf;
    this.pos = 0;
    this.full = false;
    this.acc = new Array(n);
  }

  XDropLast.prototype['@@transducer/init'] = _xfBase.init;

  XDropLast.prototype['@@transducer/result'] = function (result) {
    this.acc = null;
    return this.xf['@@transducer/result'](result);
  };

  XDropLast.prototype['@@transducer/step'] = function (result, input) {
    if (this.full) {
      result = this.xf['@@transducer/step'](result, this.acc[this.pos]);
    }

    this.store(input);
    return result;
  };

  XDropLast.prototype.store = function (input) {
    this.acc[this.pos] = input;
    this.pos += 1;

    if (this.pos === this.acc.length) {
      this.pos = 0;
      this.full = true;
    }
  };

  return XDropLast;
}();

var _xdropLast =
/*#__PURE__*/
_curry2(function _xdropLast(n, xf) {
  return new XDropLast(n, xf);
});

var _xdropLast$1 = _xdropLast;

/**
 * Returns a list containing all but the last `n` elements of the given `list`.
 *
 * Acts as a transducer if a transformer is given in list position.
 *
 * @func
 * @memberOf R
 * @since v0.16.0
 * @category List
 * @sig Number -> [a] -> [a]
 * @sig Number -> String -> String
 * @param {Number} n The number of elements of `list` to skip.
 * @param {Array} list The list of elements to consider.
 * @return {Array} A copy of the list with only the first `list.length - n` elements
 * @see R.takeLast, R.drop, R.dropWhile, R.dropLastWhile
 * @example
 *
 *      R.dropLast(1, ['foo', 'bar', 'baz']); //=> ['foo', 'bar']
 *      R.dropLast(2, ['foo', 'bar', 'baz']); //=> ['foo']
 *      R.dropLast(3, ['foo', 'bar', 'baz']); //=> []
 *      R.dropLast(4, ['foo', 'bar', 'baz']); //=> []
 *      R.dropLast(3, 'ramda');               //=> 'ra'
 */

var dropLast =
/*#__PURE__*/
_curry2(
/*#__PURE__*/
_dispatchable([], _xdropLast$1, dropLast$2));

var dropLast$1 = dropLast;

/**
 * Returns a lens for the given getter and setter functions. The getter "gets"
 * the value of the focus; the setter "sets" the value of the focus. The setter
 * should not mutate the data structure.
 *
 * @func
 * @memberOf R
 * @since v0.8.0
 * @category Object
 * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
 * @sig (s -> a) -> ((a, s) -> s) -> Lens s a
 * @param {Function} getter
 * @param {Function} setter
 * @return {Lens}
 * @see R.view, R.set, R.over, R.lensIndex, R.lensProp
 * @example
 *
 *      const xLens = R.lens(R.prop('x'), R.assoc('x'));
 *
 *      R.view(xLens, {x: 1, y: 2});            //=> 1
 *      R.set(xLens, 4, {x: 1, y: 2});          //=> {x: 4, y: 2}
 *      R.over(xLens, R.negate, {x: 1, y: 2});  //=> {x: -1, y: 2}
 */

var lens =
/*#__PURE__*/
_curry2(function lens(getter, setter) {
  return function (toFunctorFn) {
    return function (target) {
      return map$1(function (focus) {
        return setter(focus, target);
      }, toFunctorFn(getter(target)));
    };
  };
});

var lens$1 = lens;

/**
 * Returns a lens whose focus is the specified path.
 *
 * @func
 * @memberOf R
 * @since v0.19.0
 * @category Object
 * @typedefn Idx = String | Int
 * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
 * @sig [Idx] -> Lens s a
 * @param {Array} path The path to use.
 * @return {Lens}
 * @see R.view, R.set, R.over
 * @example
 *
 *      const xHeadYLens = R.lensPath(['x', 0, 'y']);
 *
 *      R.view(xHeadYLens, {x: [{y: 2, z: 3}, {y: 4, z: 5}]});
 *      //=> 2
 *      R.set(xHeadYLens, 1, {x: [{y: 2, z: 3}, {y: 4, z: 5}]});
 *      //=> {x: [{y: 1, z: 3}, {y: 4, z: 5}]}
 *      R.over(xHeadYLens, R.negate, {x: [{y: 2, z: 3}, {y: 4, z: 5}]});
 *      //=> {x: [{y: -2, z: 3}, {y: 4, z: 5}]}
 */

var lensPath =
/*#__PURE__*/
_curry1(function lensPath(p) {
  return lens$1(path$1(p), assocPath$1(p));
});

var lensPath$1 = lensPath;

/**
 * Returns a lens whose focus is the specified property.
 *
 * @func
 * @memberOf R
 * @since v0.14.0
 * @category Object
 * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
 * @sig String -> Lens s a
 * @param {String} k
 * @return {Lens}
 * @see R.view, R.set, R.over
 * @example
 *
 *      const xLens = R.lensProp('x');
 *
 *      R.view(xLens, {x: 1, y: 2});            //=> 1
 *      R.set(xLens, 4, {x: 1, y: 2});          //=> {x: 4, y: 2}
 *      R.over(xLens, R.negate, {x: 1, y: 2});  //=> {x: -1, y: 2}
 */

var lensProp =
/*#__PURE__*/
_curry1(function lensProp(k) {
  return lens$1(prop$1(k), assoc$1(k));
});

var lensProp$1 = lensProp;

var Const = function (x) {
  return {
    value: x,
    'fantasy-land/map': function () {
      return this;
    }
  };
};
/**
 * Returns a "view" of the given data structure, determined by the given lens.
 * The lens's focus determines which portion of the data structure is visible.
 *
 * @func
 * @memberOf R
 * @since v0.16.0
 * @category Object
 * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
 * @sig Lens s a -> s -> a
 * @param {Lens} lens
 * @param {*} x
 * @return {*}
 * @see R.prop, R.lensIndex, R.lensProp
 * @example
 *
 *      const xLens = R.lensProp('x');
 *
 *      R.view(xLens, {x: 1, y: 2});  //=> 1
 *      R.view(xLens, {x: 4, y: 2});  //=> 4
 */


var view$1 =
/*#__PURE__*/
_curry2(function view(lens, x) {
  // Using `Const` effectively ignores the setter function of the `lens`,
  // leaving the value returned by the getter function unmodified.
  return lens(Const)(x).value;
});

var view$2 = view$1;

/* Built in Replies
 *
 * Markdown files read by the parser may refer to these
 * to avoid entering in a list of reply options
 * 
 * These take the same form as user-generated replies: the key is the 
 * unique name of the reply, the value is an array of Strings the user
 * may select from.
 */

const BUILT_IN_REPLIES = {
    yes: ['yes', 'no'],
    true: ['true', 'false'],
    accept: ['accept', 'reject'],
    done: ['done', 'not done']
};

/* 
 * This file contains the js object data structure used to store the 
 * configuration needed to define the behavior of page.support compliant bots. 
 * 
 * Page.support applications have two parts:
 *   1. a publisher used by bot creators
 *   2. a bot UI client that interacts with end users
 * 
 * Page.support publisher apps create this data structure described in this 
 * file and bot clients use it to drive the conversation in the bot's UI. This
 * file defines as narrow an interface as possible between publishers and 
 * clients to decouple publishers and clients and facilitate an ecosystem on
 * both sides. This file should avoid including information that is only relevant 
 * to specific implementations of a publisher or bot. 
 * 
 * This config does NOT contain any runtime or user information. If 
 * a user answers a question, that answer string goes into a separate data 
 * structure resident on the client. In the Bot reference implementation this 
 * is the conversation data structure. In general, clients don't share runtime 
 * data with publisher applications. Bot clients may share user replies with
 * other server side APIs however for logging, personalization, etc.
 *
 * A bot models a set of Frames that are used for a particular purpose.
 * For instance, a business might have a bot that screens leads for sales,
 * and another bot that answers support inquiries for existing customers. Each 
 * of these may be one Frame.
 * 
 * This file should define the conversation with the user not the implementation  
 * of the conversation. This configuration should allow any page.support compliant 
 * bot to have the same conversation with a user - ask the same questions and 
 * accept the same replies. 
 * 
 * Different bot client implementations may enable different UI cosmetic designs
 * (colors, fonts, CSS, sizes), UI types (native mobile vs web), and different 
 * communication methods (voice, text, etc) and platforms (vendor specific 
 * chat apps like Whatsapp, Fb messenger, SMS, etc)
 * 
 * In addition to the javascript object, this file contains a set of Lenses
 * that may be used to access the object. 
 * 
 */

// Lens into the frames and frame Array
lensProp$1('startFrameId');
const allFramesLens = lensProp$1('frames');
lensProp$1('name');
// the frame objects, without their frameId keys, flattened into an Array
// this allows indexing into specific frames but note that retrieval by
// order insertion is not guaranteed in x-browser scenarios, which means it
// does usually work for testing.
const allFramesArray = (bot) => Object.values(view$2(allFramesLens, bot));


// slotTypeEnum defines how the bot client handles the slot. Its written by the 
// publisher and read by the client. 
const slotTypeEnum = Object.freeze({ 
  
  // Single tells client to present a list of options to the user and let
  // then pick one.
  single: 'single', 
  
  // Multiple tells client to present a list of options to the user and let
  // then pick one OR MORE. 
  multiple: 'multiple', 
  
  // Diagnostic tells the client to ask the user to complete an action then
  // report back when the user is done. What distinguishes the diagnostic 
  // type from the 'single' type is that the client doesn't care about storing
  // or using the user's answer beyond knowing when they have completed a task
  // for the purposes of moving to the next slot. If the outcome of completing
  // the task needs to be used by a backend or a trigger use 'single' instead.
  // Clients only care about completion so in text interfaces can omit 
  // presenting the user with a list of options
  // like in 'single' slots, and just show a 'done' button for the user to click.
  diagnostic: 'diagnostic', 
  
  // newTabAnswer tells the client to open a new tab after the user replies, 
  // for example by putting the reply into search URL and loading it into a 
  // new tab.
  newTabAnswer: 'newTabAnswer', 
  
  // Answer tells the client that this slot is at the end of a Frame - no
  // reply is expected from the user. Its used to give the user a final
  // answer to an intent, e.g. recommend a product/action, give a diagnosis, etc.
  // Publishers should not associate a reply with this type of slot. 
  answer: 'answer',
  
  // endConversation signals to the UI that there is no next slot, i.e. the 
  // conversation is over.
  endConversation: 'endConversation'
});
// Unlike slotNameLens, this one operates on an element of the slot array
// used for uniqueness checks.
lensProp$1('name');



// Return the slot object whose name === the name in the argument. Looks across
// all frames (the whole bot where each slot as a unique name)
// Returns null if no slot has that name
function getSlotByName( name = '', bot = {} ) {
  for (const frame of allFramesArray(bot)) {
    for (const slot of frame.slots) {
      if (slot.name === name) return slot;
    }
  }
  return null;
}



/****************** Replies ********************/

/* Replies are defined by the user, saved into the Bot's
 * replies object with the reply's name as the key and value is
 * an array of allowed replies we'll accept from the user.
 */  
      

// Lens into a specific value in a reply's Array of possible user replies
// 'name' is used in the slot's replyId property to identify the unique 
// reply since reply names are unique in the reply object is a Map with reply
// name keys
const replyValuesLens = (name, valueIndex) => 
    lensPath$1(['replies', name, valueIndex]);
// Lens into a given reply, identified by the replyName argument which is the
// key in the replies Object.    
const replyObjLens = (name) =>
    lensPath$1(['replies', name]);
lensProp$1('replies');

/************** Mixin that implements trigger evaluation ****************/

// Everything needed to evaluate a trigger.  Used in both client and publisher 

// Globals in this module used for parser init
// See https://github.com/silentmatt/expr-eval#parserevaluateexpression-string-variables-object
const Parser = require$$0.Parser;
const triggerParser = new Parser();



/* formulaFactory() => function
 * Returns an instance the function defined in comparisonFunction with caller's
 * lexical scope allowing the syntax written by the publisher to 
 * avoid including repliesAsProps as an argument. All comparisons between
 * user replies and trigger 
 * Args: 
 *    - repliesAsProps object returned by askedSlotResponsesAsProp()
 *    - comparisonFunction is a reference to one of our home grown functions like
 *      hasSameMembers()
 *    - bot is instance of botConfig, which lets us check the user entered 
 *      formula for slot references that don't exist in the slot list.
 * 
 * See: https://github.com/silentmatt/expr-eval#pre-defined-functions
 * to use
 * Usage: triggerParser.functions.isEqual = formulaFactory(repliesAsProps, 
 *                                                         comparisonFunc);
 *        call the factory each time a new replieseAsProps is available, i.e.
 *        at the end of each round of conversation. 
 * Note: we're comparing indexes not values, so we don't need to include
 *       the name of pre-defined slots when it differs from the slot name.
 *       As long as the trigger writer was looking at the right reply index
 *       the formula will return the correct value. Same goes for diagnostics
 *       where the UUID based slot.name is different from the 'done' built in.
 */
function formulaFactory(repliesAsProps, comparisonFunction, bot = null) {
  
  // Evaluate a trigger for a given slot, using the existing
  // set of answered slots (repliesAsProps), return boolean
  // Defines custom functions used by publishers in triggers described
  // here https://github.com/silentmatt/expr-eval#custom-javascript-functions
  // Note that because we're comparing indexes not values in repliesAsProps,
  // it doesn't matter if the slot is re-using a reply with a different name 
  // than the slot. The publisher that gives us the indexes uses
  // the reply they specified with the slot, making the semantic meaning of the
  // reply values the same for publisher and user.
  // Args for the trigger function written by the publisher:
  //   - REQUIRED: slotName : String is unique name of the slot stored in bot
  //   - REQUIRED: triggerTrueIndexes: Array of publisher-specified 0 based
  //               integer indexes to compare to the userReplyIndexes array. 
  // Returns: boolean
  return (slotName, triggerTrueIndexes) => {
    
    if (!slotName || Array.isArray(slotName)) throw new slotTriggerError(
      `The first argument in a trigger formula must be a question name.`); 

    // Error if the trigger references a non-existent slot name. Only run
    // this if bot passed in, which occurs when called by validateSlotTrigger()
    // but not by getNextSlot()
    if (bot && !getSlotByName(slotName, bot)) throw new slotTriggerError(
       `The question name "${slotName}" does not exist. Possibly a typo?
       Correct typo or add ${slotName} to a tag so the trigger can evaluate it.`);

    if (!triggerTrueIndexes || triggerTrueIndexes.length == 0) throw new slotTriggerError(
      `Trigger formulas must have one or more indexes as the second argument
        - check triggers that include ${slotName}`);

    // get the indexes of the user reply(s) input by the user from round.
    const userReplyIndexes = repliesAsProps[slotName];

    // When running the bot: if the slot hasn't been filled/answered by the user 
    // yet, treat the whole trigger as false.  This will occur due to the linear
    // nature of the config file whose execution of each ask is a tree. 
    // Execution will skip irrelevant/unanswered parts of the list.
    if (!userReplyIndexes) { 
        return false;
    }

    // Compare the index(s) in the trigger (triggerTrueIndexes) to what the user 
    // picked (userReplyIndexes)
     return comparisonFunction(userReplyIndexes, triggerTrueIndexes);
  }
}    



/* hasSameMembers(arrayA, arrayB) => boolean
 * Returns true if arrays a and b have same length, same primitive
 * elements, in ANY order.  False otherwise.  
 * Don't use for for non-primitive elements that can't be compared with ===
 */
function hasSameMembers(arrayA, arrayB) {
  if (!Array.isArray(arrayA) || !Array.isArray(arrayB)) {
    throw new Error('hasSameMembers() called with non-array argument');
  } 
  const a = [...arrayA].sort(); // make copies since sort modifies in place
  const b = [...arrayB].sort(); 
  return a.length === b.length && a.every((val, index) => val === b[index]);
}



/* isSubset(subSetArray = [], superSetArray = []) => boolean
 * Returns true if all of subSetArray's members exist in superSetArray. Order 
 * is not important, but all elements must be primitives. False otherwise.  
 * Don't use for non-primitive elements that can't be compared with ===
 */
function isSubset(subSetArray, superSetArray) {
  if (!Array.isArray(subSetArray) || !Array.isArray(superSetArray)) {
    throw new Error('isSubSet() called with non-array argument');
  } 
  return subSetArray.every( el => superSetArray.includes(el) );
}



/* hasOneOrMoreSharedMember(subSetArray = [], superSetArray = []) => boolean
 * Returns true if at least one of subSetArray's members exist in superSetArray. 
 * Order is not important, but all elements must be primitives. False otherwise.  
 * Don't use for non-primitive elements that can't be compared with ===
 */
function hasOneOrMoreSharedMember(subSetArray, superSetArray) {
  if (!Array.isArray(subSetArray) || !Array.isArray(superSetArray)) {
    throw new Error('hasOneOrMoreSharedMember() called with non-array argument');
  } 
  
  for (let val of subSetArray) { 
    if (superSetArray.includes(val)) return true;
  } 
  return false; // if no el of subSetArray is included in superSetArray
}


function replyEvalFunction(replyName = '', valueIndex = null) {
  // if valueIndex present, return String of that value
  if (valueIndex) {
    return view(replyValuesLens(replyName, valueIndex), bot);
  } else {

    // if not present, return Array of all values so caller can use
    // it in 'in' expression
    return view(replyObjLens(replyName), bot);
  }
}


/* Evaluate a single slot trigger and return a boolean result.
 * Raise an instance of slotTriggerError() if parsing fails.
 * Uses https://github.com/silentmatt/expr-eval to parse the expresssion
 * 
 * Prerequisites: caller must first set reply function in lexicalcontext of a bot
 *    for example: parser.functions.reply = config.replyEvalFunction; 
 * See parser.js replyEvalFunction for an example of usage.
 */
function evaluateSlotTrigger(trigger, slotResponsesAsProperties) {
  // check that trigger and slotResponses are not empty
  if (!trigger) throw new slotTriggerError(`Trigger argument must not be empty.`);
  
  // Scenario where first slot has a trigger, but slotResponsesAsProperties is 
  // empth because there are no preceeding slots.
  if (Object.keys(slotResponsesAsProperties).length === 0) { 
    throw new slotTriggerError(`Adding a trigger to ` +  
      `the first slot is unnecessary since the first slot will always execute.`);
  }

  try {
    // parser may return non-boolean which means the user input a bad trigger
    // TODO: passing in slotResp.. probably not needed anymore since the three functions
    // obviate the need for regular equality checking 
    const result = triggerParser.evaluate(trigger, slotResponsesAsProperties);
    if (typeof result === 'boolean') {
      return result;  // Success!
    } else {
      throw new slotTriggerError(`Triggers must evaluate to true or false.  
                                  "${trigger}" did not.`);
    }
  } catch (e) {
    console.log(e);
    throw new slotTriggerError(`${e} in "${trigger}"`);
  }
}




function slotTriggerError(message) {
	this.name = 'Trigger Missing Or Invalid';
  this.message = message;
  // example and docAnchorHTML are rendered as HTML by the view below the error
  this.exampleHTMLStr = `Example:<br>
    slot.trigger: same('TOSAccepted', [0])<br><br>`;
	this.stack = (new Error()).stack;
}
slotTriggerError.prototype = new Error;

/* dialog.js handles dialog policy - what to say next given the current 
 * conversation state and bot configuation. 
 *
 */


/**************** CONSTANTS and Declarations ******************/



/***************** Constructors *******************************/


/* Constructor for Conversation objects that tracks everything said by bot and 
 * human in this session. Includes all frames the user engages with in a session.
 * Args:
 *   frames: bot.frames (from newBot constructor in BotConfig.js)
 *   allReplyOptions: Array of strings user selects from in UI
 *   botCosmetics: the botConfig property that styles the GUI 
 */
const newConversation = ({ frames = [], 
                           currentFrame = '',
                           replies = {}, 
                           botCosmetics = {}
                         }) => ({
  // in VO.1 this is fixed to zero since we don't have server side NLU
  // to select the frame using phrasings. When this changes, also change 
  // the index to frames in localeString below
  currentFrame: currentFrame,  // Index into the frame Array in BotConfig 
  
  // Unicode locale identifier string used for lexicographic sorting and other
  // language specific handling.
  localeString: frames[currentFrame].localeString,

  // used in Bot.svelte to display intro at start of frame conversation
  introduction: frames[currentFrame].introduction,
  
  // Copy of botConfig.frames with already served slots removed so we don't 
  // re-evaluate their triggers and repeat questions.
  unSpokenFrames: clone$1(frames),   // frames is an array

  // Chronologically ordered Array of Round objects.
  // Enables editing earlier answers and showing history in GUI. 
  completedRounds: [],

  allReplyOptions: clone$1(replies),
  botCosmetics: botCosmetics
});


/* Constructor for instance of a conversation Round that tracks everything that  
 * was said in one convesation Round.  Each Round is appendded to 
 * conversation.completedRounds[] when populated with bot question and user reply.
 * Used to:
 *   track history of the conversation and related stats for display in UI
 *   evaluate triggers based on replies user has already given
 */
const newRound = ({ slot = {},
                    frameId = '',
                    userReplyValues = [],
                    userReplyIndexes = [],
                    ending = '',
                    stats = {} }) => ({
    slot,          // Object: the whole Slot object as defined in BotConfig.js
    frameId,    // String: name of the frame this slot belongs to
    userReplyValues,   // Array of Strings: the values said or clicked by the user   
    userReplyIndexes,  // Array of Integers: indexes of the replies in replyValues.
    // one element in array if type: single, possibly > 1 if 
    // type:multiple, empty if free form input
    ending,        // String: how the round ended: one of the enum ENDINGS
    stats          // Object: Any stats we want to track on a per-round basis
  });

// Standardized recording of how conversation ended, optionally populated by
// UI clients that want to log this info.
const ENDINGS = Object.freeze({
  completed: 'completed',         // user gave valid reply
  invalidReply: 'invalidReply',   // user gave invalid reply
  abandoned: 'abandoned',         // user gave no reply, disappeared
  chatAgent: 'chatAgent',         // user gave no reply, clicked chat agent
  callAgent: 'callAgent'          // user gave no reply, clicked call agent
});


/****************** Functions **********************************/


/* initConversation() => Conversation instance or null if error
 * Start a new conversation from the beginning. Return empty conversation tracker 
 * object to UI component. This object, in conjunction with functions in this 
 * file enable Bot.svelte to handle all of the UI rendering including history.
 * 
 * Returns Conversation object or null if botConfig invalid or missing
 * 
 * See scenarios in Bot.svelte for usage.
 * 
 * Args
 *    bot: REQUIRED: instance of botConfig or null if none. If null, some other
 *        mechanism must be calling saveState to save a config, such as runBot()
 *    currentFrame: REQUIRED: integer
 *    localStorageKey: REQUIRED: unique-per-domain key where conversation state
 *    and botConfig are stored.
 * 
 */
function initConversation(bot, currentFrame, localStorageKey) {
  if (bot === undefined || 
      currentFrame === undefined || 
      localStorageKey === undefined) {
    console.log(`initConversation(): an argument is undefined: 
      bot:${bot}\ncurrentFrame:${currentFrame}\nlocalStorageKey:${localStorageKey}`);
    return null;
  }
  
  // if we get here we have all the required arguments, create new conversation 
  const newConv = newConversation({ frames: bot.frames,
    currentFrame: currentFrame,
    replies: bot.replies,
    botCosmetics: bot.botCosmetics
  }); 

  // persist to sessionStorage and return it
  saveConversation(newConv, localStorageKey);
  return newConv;
}



/* getNextSlot() 
 * Return the whole Round history to the UI so it can display the ask and the
 * user replies to the user. History includes the latest ask in a Round, stored
 * in the last element in the completedRounds array. 
 * This function is the interface to Bot.svelte which manages the UI. 
 * Scenarios:
 *   1) in publisher: publisher calls startNewConversation(newBot) which 
 *      caches newBot as the botConfig and inits a new conversation tracker.
 *      no botConfig argument needed.
 *   2) in 3P site: botConfig will be null, causing fetchBotConfigFromRemote()
 *      to fetch and cache a botConfig in localStorage.  No botConfig argument.
 *   3) Storybook passes in the testBotConfig prop from Bot.stories.js into
 *      loadConversation() which passes it in to this function's botConfig arg
 *      only the call to getNextSlot() in loadConversation needs to pass it in,
 *      it will be cached after the first load. 
 * 
 * Args: REQUIRED: localStorageKey is used to save state to localStorage
 * 
 * Returns: Object { 
 *   completedRounds: conversation.completedRounds,   # Array of Rounds
 *   replyType:nextSlot.type # a property of config.slotTypeEnum
 *   allReplyOptions: [String,..] # String replies the user picks
 *                                  from for this ask
 *   }   
 *         
 *   or returns null if we're at the end of the conversation.
 */
function getNextSlot(localStorageKey) {
  // use existing conversation if tracker exists, otherwise start new conversation
  const conversation = getConversation(localStorageKey);

  // get slots for current frame
  // TODO: when > 1 frames, need to change this to all slots in all frames
  const slotCandidates =
    conversation.unSpokenFrames[conversation.currentFrame].slots;

  // put all the replies so far into object for use by trigger parser  
  const repliesAsProps = askedSlotResponsesAsProp(conversation.completedRounds);

  // assign custom functions to trigger parser so it can eval triggers.
  // pass in bot and replies as Props for context to factory functions.

  // Naming: "user replies have same member indexes as trigger indexes in formula"
  triggerParser.functions.same = formulaFactory(repliesAsProps,
    hasSameMembers);
  // Naming: "user replies are a subset of trigger indexes in formula"
  triggerParser.functions.subset = formulaFactory(repliesAsProps,
    isSubset);
  // Naming: "user replies share some members as trigger indexes in formula"                                                  
  triggerParser.functions.share = formulaFactory(repliesAsProps,
    hasOneOrMoreSharedMember);

  // Description: "returns the value for the indicated pre-defined reply"
  triggerParser.functions.reply = formulaFactory(repliesAsProps, 
    replyEvalFunction);

  const nextSlot = returnFirstTrueSlotTrigger(slotCandidates, repliesAsProps);

  if (nextSlot === undefined) {
    // If no slot was found we're at the end of the conversation.
    return {
      completedRounds: clone$1(conversation.completedRounds),
      replyType: slotTypeEnum.endConversation,
      replyOptions: null
    }
  
  } else {
    // if slot not already there, e.g. because user refreshed page, add slot
    if (conversation.completedRounds.length === 0 ||
        (conversation.completedRounds.length > 0 && 
         nextSlot.name !== conversation.completedRounds
           [conversation.completedRounds.length - 1].slot.name) ) {
      // create and save the slot portion of the round in the conversation tracker
      // leaving recording of the reply to saveReply() after user replies
      const round = newRound({
        slot: clone$1(nextSlot),
        frameId: conversation.currentFrame,
      });
      conversation.completedRounds.push(round);
      saveConversation(conversation, localStorageKey);
    }

    // return what UI needs to present next ask to user. Clone it so UI specific
    // transformations don't affect the recorded conversation. 
    return {
      completedRounds: clone$1(conversation.completedRounds),
      replyType: clone$1(nextSlot.type),
      replyOptions: clone$1(conversation.allReplyOptions[nextSlot.replyId])
      }
    }
  }

  

/* rewindConversation() => undefined or null if error
  * Add answered slots after the index back to slot candidate list
  * so user can redo their reply at the rewoundRoundIndex reply. Also
  * remove those replies from completedRounds.
  * 
  * Args: ALL REQUIRED
  *   rewoundRoundIndex: int the index the user is rewinding to, ie. re-answering
  *   getConfigFromRemote: boolean, false if not triggering remote botConfig fetch
  *   localStorageKey: unique key for this bot's conversation in sessionStorage
  */
function rewindConversation(rewoundRoundIndex, getConfigFromRemote, localStorageKey) {
  if (rewoundRoundIndex === undefined || 
      getConfigFromRemote === undefined || 
      localStorageKey === undefined) {
    console.log(`rewindConversation(): an argument is undefined: 
      rewoundRoundIndex:${rewoundRoundIndex}\ngetConfigFromRemote:${getConfigFromRemote}\nlocalStorageKey:${localStorageKey}`);
    return null;
  }

  const conversation = getConversation(localStorageKey);

  // remove rounds from rewoundRoundIndex to the end of completedRounds array
  conversation.completedRounds = 
    conversation.completedRounds.slice(0, rewoundRoundIndex);

  // Reset unSpokenFrames to conversation start point, then remove slots
  // present in completedRounds. We don't want to get a new botConfig nor
  // force a remote reload, so both args are false.
  const bot = getBotConfig(false, 
                           getConfigFromRemote, 
                           localStorageKey,
                           false);
  conversation.unSpokenFrames = clone$1(bot.frames); 
  
  conversation.completedRounds.forEach((round) => {
    removeUnspokenSlot(conversation, round);
  });

  // Persist the conversation rewind
  saveConversation(conversation, localStorageKey);
}


/* removeUnspokenSlot(conversation: Conversation, round: Round) => undefined
 * Removes slots from the slot candidate list (unSpokenFrames.[index].slots) 
 * when a user answers the slot question. Updates conversation tracker.
 */
function removeUnspokenSlot(conversation, round) {
  // find the index of the slot using its unique name property
  const slotIndexToRemove =
    conversation.unSpokenFrames[conversation.currentFrame].slots.findIndex(
      slot => slot.name === round.slot.name);

  // remove the slot at that index to avoid re-triggering
  conversation.unSpokenFrames[conversation.currentFrame].slots.splice(
    slotIndexToRemove, 1);
}


/* returnFirstTrueSlotTrigger() => instance of a Slot or false if trigger invalid
 * evaluates slot triggers and return the first slot whose trigger is 'true' or
 * empty string or the expression evaluates to boolean true
 * Args:
 *   slotCandidates: REQUIRED: conversation.unSpokenFrames[conversation.currentFrame].slots
 *   repliesAsProps: REQUIRED: see askedSlotResponsesAsProp()
 */
function returnFirstTrueSlotTrigger(slotCandidates, repliesAsProps) {

  return slotCandidates.find(slot => {
    try {
      return ((slot.trigger === '') ||
              (slot.trigger === undefined) ||
              (slot.trigger === 'true') ||
              evaluateSlotTrigger(slot.trigger, repliesAsProps))
    } catch (e) {
      // Evaluations of replies to slots that are untraveled will return false
      // This is normal. 
      if (e.name === 'triggerMissingOrInvalidError') {
        console.log(e);
        return false;
      } else {
        throw e;
      }
    }
  });
}

  
  /* saveReply() => undefined
   * Update conversation tracker with just-executed reply AND
   * remove the just-presented slot. Used by UI clients like Bot.svelte when 
   * user replies. 
   * Note: This function does NOT do user input validation. TODO. When it does,
   * calling it should be wrapped in a try block by the 
   * caller and caller should handle showing the error message. At the moment
   * Bot.svelte only allows selecting from a system-provided list, so unless 
   * the user goes out of their way to hack an invalid reply, errors won't occur
   * but this will change if free text or voice is allowed.
   * Args:
   *   See newRound() constructor and ENDINGS constant for definitions.
   *   All are required, but stats may be empty object.
   */
  function saveReply({ userReplyValues, 
                       userReplyIndexes, 
                       ending, 
                       stats, 
                       localStorageKey }) {

    const conversation = getConversation(localStorageKey);
    // record the new user reply in the existing round created by getNextSlot()
    // which is the last round object in the array.
    const round = conversation.completedRounds[conversation.completedRounds.length - 1];

    round.userReplyValues = userReplyValues;
    round.userReplyIndexes = userReplyIndexes;
    round.ending = ending;
    round.stats = stats;

    // Remove the slot contained in round from the current conversation so
    // it doesn't trigger in the future (because user answered it)
    removeUnspokenSlot(conversation, round);

    // Persist the conversation
    saveConversation(conversation, localStorageKey);
  }


  /***************** Trigger Evaluation Functions ************/


  /* askedSlotResponsesAsProp() => {}
   * Enables evaluating trigger expressions using completedRounds.
   * Args: 
   *   instance of completedRounds as defined in the conversation constructor
   *  
   * Returns an object in the form 
   *  { slotName1: replyIndexArray1, slotName2: replyIndexArray2, .. } or
   *  { gender: [0], countries: [3, 4, 1] }
   * 
   * For single-response replies each replyIndexArray only has the first index
   * populated. The index in that array is an integer index into the 
   * replyValues for the slot.  For multi-response replies, any number might be populated. 
   * The returned object includes all slots in all frames that have been 
   * answered by the user. 
   *
   * Used in: client after each round of conversation.  
   */
  function askedSlotResponsesAsProp(completedRounds) {
    let returnObj = {};
    completedRounds.forEach(round => {
      returnObj[round.slot.name] = round.userReplyIndexes;
    });
    return returnObj;
  }

/** 
 * Dispatch event on click outside of the DOM element in the argument.
 * Imported into any component that needs to open/close
 * a modal, select box or other ui element when the user clicks
 * outside of it
 * Args: node is the html node we want to detect clicks outside of
 * Derived from https://svelte.dev/repl/0ace7a508bd843b798ae599940a91783?version=3.16.7
 **/
function clickOutside(node) {
  
  const handleClick = event => {
    if (node && !node.contains(event.target) && !event.defaultPrevented) {
      node.dispatchEvent(
        new CustomEvent('click_outside', node)
      );
    }
  };

	document.addEventListener('click', handleClick, true);
  
  return {
    destroy() {
      document.removeEventListener('click', handleClick, true);
    }
	}
}

/* src/ui/MultiSelect.svelte generated by Svelte v3.44.2 */

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[14] = list[i];
	return child_ctx;
}

function get_each_context_1$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[17] = list[i];
	child_ctx[18] = list;
	child_ctx[19] = i;
	return child_ctx;
}

// (103:2) {#if showOptions}
function create_if_block_3$1(ctx) {
	let ul;
	let each_value_1 = /*replyObjects*/ ctx[3];
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
	}

	return {
		c() {
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(ul, "class", "mb-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm");
			attr(ul, "tabindex", "-1");
			attr(ul, "role", "listbox");
			attr(ul, "aria-labelledby", "listbox-label");
			attr(ul, "aria-activedescendant", "listbox-option-3");
		},
		m(target, anchor) {
			insert(target, ul, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(ul, null);
			}
		},
		p(ctx, dirty) {
			if (dirty & /*replyObjects, select*/ 24) {
				each_value_1 = /*replyObjects*/ ctx[3];
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1$1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}
		},
		d(detaching) {
			if (detaching) detach(ul);
			destroy_each(each_blocks, detaching);
		}
	};
}

// (141:10) {#if replyObj.selected}
function create_if_block_4$1(ctx) {
	let svg;
	let path;

	return {
		c() {
			svg = svg_element("svg");
			path = svg_element("path");
			attr(path, "fill-rule", "evenodd");
			attr(path, "d", "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z");
			attr(path, "clip-rule", "evenodd");
			attr(svg, "class", "h-5 w-5");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "viewBox", "0 0 20 20");
			attr(svg, "fill", "currentColor");
			attr(svg, "aria-hidden", "true");
		},
		m(target, anchor) {
			insert(target, svg, anchor);
			append(svg, path);
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (114:4) {#each replyObjects as replyObj, index}
function create_each_block_1$1(ctx) {
	let li;
	let span0;
	let t0_value = /*replyObj*/ ctx[17].value + "";
	let t0;
	let t1;
	let span1;
	let t2;
	let mounted;
	let dispose;
	let if_block = /*replyObj*/ ctx[17].selected && create_if_block_4$1();

	function mouseenter_handler() {
		return /*mouseenter_handler*/ ctx[8](/*replyObj*/ ctx[17], /*each_value_1*/ ctx[18], /*index*/ ctx[19]);
	}

	function mouseleave_handler() {
		return /*mouseleave_handler*/ ctx[9](/*replyObj*/ ctx[17], /*each_value_1*/ ctx[18], /*index*/ ctx[19]);
	}

	function click_handler() {
		return /*click_handler*/ ctx[10](/*index*/ ctx[19]);
	}

	return {
		c() {
			li = element("li");
			span0 = element("span");
			t0 = text(t0_value);
			t1 = space();
			span1 = element("span");
			if (if_block) if_block.c();
			t2 = space();
			attr(span0, "class", "font-normal block truncate");
			toggle_class(span0, "font-semibold", /*replyObj*/ ctx[17].selected);
			attr(span1, "class", "text-gray-600 absolute inset-y-0 left-0 flex items-center pl-1.5");
			toggle_class(span1, "text-white", /*replyObj*/ ctx[17].highlighted === true);
			attr(li, "class", "text-gray-900 cursor-default select-none relative py-2 pl-8 pr-4 svelte-n5we1s");
			attr(li, "id", "listbox-option-0");
			attr(li, "role", "option");
			toggle_class(li, "highlightedOption", /*replyObj*/ ctx[17].highlighted === true);
		},
		m(target, anchor) {
			insert(target, li, anchor);
			append(li, span0);
			append(span0, t0);
			append(li, t1);
			append(li, span1);
			if (if_block) if_block.m(span1, null);
			append(li, t2);

			if (!mounted) {
				dispose = [
					listen(li, "mouseenter", mouseenter_handler),
					listen(li, "mouseleave", mouseleave_handler),
					listen(li, "click", click_handler)
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*replyObjects*/ 8 && t0_value !== (t0_value = /*replyObj*/ ctx[17].value + "")) set_data(t0, t0_value);

			if (dirty & /*replyObjects*/ 8) {
				toggle_class(span0, "font-semibold", /*replyObj*/ ctx[17].selected);
			}

			if (/*replyObj*/ ctx[17].selected) {
				if (if_block) ; else {
					if_block = create_if_block_4$1();
					if_block.c();
					if_block.m(span1, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (dirty & /*replyObjects*/ 8) {
				toggle_class(span1, "text-white", /*replyObj*/ ctx[17].highlighted === true);
			}

			if (dirty & /*replyObjects*/ 8) {
				toggle_class(li, "highlightedOption", /*replyObj*/ ctx[17].highlighted === true);
			}
		},
		d(detaching) {
			if (detaching) detach(li);
			if (if_block) if_block.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (184:6) {#each selectedReplyIndexes as selectedReplyIndex}
function create_each_block$1(ctx) {
	let li;
	let span0;
	let t0_value = /*replyOptions*/ ctx[1][/*selectedReplyIndex*/ ctx[14]] + "";
	let t0;
	let t1;
	let span1;
	let t2;
	let mounted;
	let dispose;

	function click_handler_1() {
		return /*click_handler_1*/ ctx[11](/*selectedReplyIndex*/ ctx[14]);
	}

	return {
		c() {
			li = element("li");
			span0 = element("span");
			t0 = text(t0_value);
			t1 = space();
			span1 = element("span");

			span1.innerHTML = `<svg class="fill-current h-6 w-6 " role="button" viewBox="0 0 20 20"><path d="M14.348,14.849c-0.469,0.469-1.229,0.469-1.697,0L10,11.819l-2.651,3.029c-0.469,0.469-1.229,0.469-1.697,0
                                           c-0.469-0.469-0.469-1.229,0-1.697l2.758-3.15L5.651,6.849c-0.469-0.469-0.469-1.228,0-1.697s1.228-0.469,1.697,0L10,8.183
                                           l2.651-3.031c0.469-0.469,1.228-0.469,1.697,0s0.469,1.229,0,1.697l-2.758,3.152l2.758,3.15
                                           C14.817,13.62,14.817,14.38,14.348,14.849z"></path></svg>`;

			t2 = space();
			attr(span0, "class", "font-normal block truncate");
			attr(span1, "class", "text-gray-600 absolute inset-y-0 left-0 flex items-center pl-1.5");
			attr(li, "class", "text-gray-900 cursor-default block select-none relative py-1 pl-8 pr-4");
			attr(li, "id", "listbox-option-0");
			attr(li, "role", "option");
		},
		m(target, anchor) {
			insert(target, li, anchor);
			append(li, span0);
			append(span0, t0);
			append(li, t1);
			append(li, span1);
			append(li, t2);

			if (!mounted) {
				dispose = listen(span1, "click", click_handler_1);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*replyOptions, selectedReplyIndexes*/ 3 && t0_value !== (t0_value = /*replyOptions*/ ctx[1][/*selectedReplyIndex*/ ctx[14]] + "")) set_data(t0, t0_value);
		},
		d(detaching) {
			if (detaching) detach(li);
			mounted = false;
			dispose();
		}
	};
}

// (220:4) {#if selectedReplyIndexes.length === 0}
function create_if_block_2$1(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			div.textContent = "Select one or more options";
			attr(div, "class", "flex-1 text-gray-800 h-full w-full p-1 px-2 pl-3");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (227:4) {#if !showOptions && selectedReplyIndexes.length === 0 }
function create_if_block_1$1(ctx) {
	let span;

	return {
		c() {
			span = element("span");
			span.innerHTML = `<svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>`;
			attr(span, "class", "absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none");
		},
		m(target, anchor) {
			insert(target, span, anchor);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (251:2) {#if selectedReplyIndexes.length !== 0}
function create_if_block$1(ctx) {
	let button;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
			button.textContent = "Done";
			attr(button, "class", "mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-md text-white bg-primary-color hover:bg-hover-color focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-color");
		},
		m(target, anchor) {
			insert(target, button, anchor);

			if (!mounted) {
				dispose = listen(button, "click", /*submit*/ ctx[6]);
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

function create_fragment$1(ctx) {
	let div;
	let t0;
	let button;
	let ul;
	let t1;
	let t2;
	let t3;
	let mounted;
	let dispose;
	let if_block0 = /*showOptions*/ ctx[2] && create_if_block_3$1(ctx);
	let each_value = /*selectedReplyIndexes*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	let if_block1 = /*selectedReplyIndexes*/ ctx[0].length === 0 && create_if_block_2$1();
	let if_block2 = !/*showOptions*/ ctx[2] && /*selectedReplyIndexes*/ ctx[0].length === 0 && create_if_block_1$1();
	let if_block3 = /*selectedReplyIndexes*/ ctx[0].length !== 0 && create_if_block$1(ctx);

	return {
		c() {
			div = element("div");
			if (if_block0) if_block0.c();
			t0 = space();
			button = element("button");
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t1 = space();
			if (if_block1) if_block1.c();
			t2 = space();
			if (if_block2) if_block2.c();
			t3 = space();
			if (if_block3) if_block3.c();
			attr(ul, "class", "bg-white max-h-60 py-0 text-base overflow-auto focus:outline-none sm:text-sm");
			attr(ul, "tabindex", "-1");
			attr(ul, "role", "listbox");
			attr(ul, "aria-labelledby", "listbox-label");
			attr(ul, "aria-activedescendant", "listbox-option-3");
			attr(button, "type", "button");
			attr(button, "class", "w-full bg-white border border-gray-300 rounded-md shadow-sm pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-primary-color focus:border-gray-500 sm:text-sm");
			attr(button, "aria-haspopup", "listbox");
			attr(button, "aria-expanded", "true");
			attr(button, "aria-labelledby", "listbox-label");
			attr(div, "class", "mt-1 relative sm:max-w-xs flex flex-col");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			if (if_block0) if_block0.m(div, null);
			append(div, t0);
			append(div, button);
			append(button, ul);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(ul, null);
			}

			append(button, t1);
			if (if_block1) if_block1.m(button, null);
			append(button, t2);
			if (if_block2) if_block2.m(button, null);
			append(div, t3);
			if (if_block3) if_block3.m(div, null);

			if (!mounted) {
				dispose = [
					listen(button, "click", /*click_handler_2*/ ctx[12]),
					action_destroyer(clickOutside.call(null, div)),
					listen(div, "click_outside", /*handleClickOutside*/ ctx[7])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (/*showOptions*/ ctx[2]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_3$1(ctx);
					if_block0.c();
					if_block0.m(div, t0);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (dirty & /*remove, selectedReplyIndexes, replyOptions*/ 35) {
				each_value = /*selectedReplyIndexes*/ ctx[0];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			if (/*selectedReplyIndexes*/ ctx[0].length === 0) {
				if (if_block1) ; else {
					if_block1 = create_if_block_2$1();
					if_block1.c();
					if_block1.m(button, t2);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (!/*showOptions*/ ctx[2] && /*selectedReplyIndexes*/ ctx[0].length === 0) {
				if (if_block2) ; else {
					if_block2 = create_if_block_1$1();
					if_block2.c();
					if_block2.m(button, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (/*selectedReplyIndexes*/ ctx[0].length !== 0) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block$1(ctx);
					if_block3.c();
					if_block3.m(div, null);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			if (if_block0) if_block0.d();
			destroy_each(each_blocks, detaching);
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	const dispatch = createEventDispatcher();
	let { selectedReplyIndexes = [] } = $$props;
	let { replyOptions } = $$props;

	// UI toggles
	let showOptions = false; // Boolean: show/hide replyOptions: open == true,

	// used to track which replyOptions have already been selected so the whole
	// list of replyOptions can highlight the selected ones.
	const replyObjects = replyOptions.map((replyValue, index) => {
		return { value: replyValue, selected: false };
	});

	/* Called when user clicks on a replyOption in the lower list of replyOptions.
 * Args: index is the index into replyOptions the user selected
 * Uses replyObjects array to record whether each option is selected or not.
 * Note that select also removes a reply if it had been previously selected.
 */
	function select(index) {
		// populate array and trigger reactive display of selected replies
		if (!replyObjects[index].selected) {
			// If not previously selected, select it.
			// Add the item to the upper list of selected items.
			selectedReplyIndexes.push(index);

			$$invalidate(0, selectedReplyIndexes); // trigger reactivity

			// Set the left border color in the replyObjects lower list so user can
			// see what's already selected
			$$invalidate(3, replyObjects[index].selected = true, replyObjects);

			$$invalidate(3, replyObjects);
		} else {
			remove(index);
		}
	}

	/* Called when the x is clicked in the upper list of previously selected
 * replies.
 * Args: index is the index into replyOptions and replyObjects
 */
	function remove(index) {
		// Remove the item from the upper list of selected items
		selectedReplyIndexes.splice(selectedReplyIndexes.indexOf(index), 1);

		$$invalidate(0, selectedReplyIndexes); // trigger reactivity

		// Remove the left border color in the replyObjects lower list
		$$invalidate(3, replyObjects[index].selected = false, replyObjects);

		$$invalidate(3, replyObjects);
		console.log(`removed ${index}`);
		console.log(selectedReplyIndexes.length);
	}

	/* User clicks Save/done button next to single or multi select */
	function submit() {
		dispatch("message", selectedReplyIndexes);
	}

	/* Close multiselect options list when user clicks outside of the list */
	function handleClickOutside(event) {
		$$invalidate(2, showOptions = false); // hide the options list
	}

	const mouseenter_handler = (replyObj, each_value_1, index) => $$invalidate(3, each_value_1[index].highlighted = true, replyObjects);
	const mouseleave_handler = (replyObj, each_value_1, index) => $$invalidate(3, each_value_1[index].highlighted = false, replyObjects);
	const click_handler = index => select(index);
	const click_handler_1 = selectedReplyIndex => remove(selectedReplyIndex);
	const click_handler_2 = () => $$invalidate(2, showOptions = !showOptions);

	$$self.$$set = $$props => {
		if ('selectedReplyIndexes' in $$props) $$invalidate(0, selectedReplyIndexes = $$props.selectedReplyIndexes);
		if ('replyOptions' in $$props) $$invalidate(1, replyOptions = $$props.replyOptions);
	};

	return [
		selectedReplyIndexes,
		replyOptions,
		showOptions,
		replyObjects,
		select,
		remove,
		submit,
		handleClickOutside,
		mouseenter_handler,
		mouseleave_handler,
		click_handler,
		click_handler_1,
		click_handler_2
	];
}

class MultiSelect extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { selectedReplyIndexes: 0, replyOptions: 1 });
	}
}

/* src/ui/Bot.svelte generated by Svelte v3.44.2 */

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[39] = list[i];
	child_ctx[41] = i;
	return child_ctx;
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[39] = list[i];
	child_ctx[41] = i;
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[43] = list[i].slot;
	child_ctx[44] = list[i].userReplyValues;
	child_ctx[46] = i;
	return child_ctx;
}

// (763:0) {:else}
function create_else_block(ctx) {
	let h2;

	return {
		c() {
			h2 = element("h2");
			h2.textContent = "Unknown error";
		},
		m(target, anchor) {
			insert(target, h2, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(h2);
		}
	};
}

// (756:28) 
function create_if_block_11(ctx) {
	let button;

	return {
		c() {
			button = element("button");

			button.innerHTML = `<svg class="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"></svg>
    Loading`;

			attr(button, "type", "button");
			attr(button, "class", "bg-primary-600");
			button.disabled = true;
		},
		m(target, anchor) {
			insert(target, button, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(button);
		}
	};
}

// (754:38) 
function create_if_block_10(ctx) {
	return {
		c: noop,
		m: noop,
		p: noop,
		i: noop,
		o: noop,
		d: noop
	};
}

// (752:30) 
function create_if_block_9(ctx) {
	let h2;
	let t0;
	let t1;

	return {
		c() {
			h2 = element("h2");
			t0 = text("Bot failed to load: ");
			t1 = text(/*UIError*/ ctx[9]);
			attr(h2, "class", "text-gray text-lg");
		},
		m(target, anchor) {
			insert(target, h2, anchor);
			append(h2, t0);
			append(h2, t1);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*UIError*/ 512) set_data(t1, /*UIError*/ ctx[9]);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(h2);
		}
	};
}

// (567:0) {#if showBotUI && !showUnfriendlyError}
function create_if_block(ctx) {
	let div6;
	let div1;
	let div0;
	let raw0_value = /*marked*/ ctx[13](/*frameIntroduction*/ ctx[8]) + "";
	let t0;
	let t1;
	let div5;
	let div2;
	let p;
	let raw1_value = /*marked*/ ctx[13](/*completedRounds*/ ctx[1][/*completedRounds*/ ctx[1].length - 1].slot.ask) + "";
	let t2;
	let div4;
	let div3;
	let current_block_type_index;
	let if_block0;
	let t3;
	let current;
	let each_value_2 = /*completedRounds*/ ctx[1].slice(0, -1);
	let each_blocks = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	const if_block_creators = [
		create_if_block_2,
		create_if_block_3,
		create_if_block_4,
		create_if_block_5,
		create_if_block_6,
		create_if_block_7
	];

	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (/*replyType*/ ctx[4] === slotTypeEnum.diagnostic || /*replyType*/ ctx[4] === slotTypeEnum.single && /*replyOptions*/ ctx[2][0] === BUILT_IN_REPLIES.done[0]) return 0;
		if (/*replyType*/ ctx[4] === slotTypeEnum.single) return 1;
		if (/*replyType*/ ctx[4] === slotTypeEnum.multiple) return 2;
		if (/*replyType*/ ctx[4] === "freeTextEntry") return 3;
		if (/*replyType*/ ctx[4] === slotTypeEnum.endConversation) return 4;
		if (/*replyType*/ ctx[4] !== "answer") return 5;
		return -1;
	}

	if (~(current_block_type_index = select_block_type_1(ctx))) {
		if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
	}

	let if_block1 = /*showRestartButton*/ ctx[14] && create_if_block_1();

	return {
		c() {
			div6 = element("div");
			div1 = element("div");
			div0 = element("div");
			t0 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t1 = space();
			div5 = element("div");
			div2 = element("div");
			p = element("p");
			t2 = space();
			div4 = element("div");
			div3 = element("div");
			if (if_block0) if_block0.c();
			t3 = space();
			if (if_block1) if_block1.c();
			attr(div0, "id", "frameIntroduction");
			attr(div1, "id", "conversationHistory");
			attr(div1, "class", "flex flex-col space-y-4 mb-4");
			attr(p, "class", "text-l");
			attr(div2, "id", "currentAsk");
			attr(div2, "class", "mr-4 sm:mr-12");
			attr(div3, "id", "user-reply-div");
			attr(div3, "class", "sm:ml-6 mt-2");
			attr(div4, "id", "currentUserReply");
			attr(div5, "id", "currentRound");
			attr(div5, "class", "sm:space-y-5 bg-white border-solid border border-gray-200 rounded-lg p-3");
			attr(div6, "id", "botContainer");
			attr(div6, "class", "container mx-auto border bg-container-color rounded p-2 sm:p-6 w-auto max-w-xl");
		},
		m(target, anchor) {
			insert(target, div6, anchor);
			append(div6, div1);
			append(div1, div0);
			div0.innerHTML = raw0_value;
			append(div1, t0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div1, null);
			}

			append(div6, t1);
			append(div6, div5);
			append(div5, div2);
			append(div2, p);
			p.innerHTML = raw1_value;
			append(div5, t2);
			append(div5, div4);
			append(div4, div3);

			if (~current_block_type_index) {
				if_blocks[current_block_type_index].m(div3, null);
			}

			append(div6, t3);
			if (if_block1) if_block1.m(div6, null);
			current = true;
		},
		p(ctx, dirty) {
			if ((!current || dirty[0] & /*frameIntroduction*/ 256) && raw0_value !== (raw0_value = /*marked*/ ctx[13](/*frameIntroduction*/ ctx[8]) + "")) div0.innerHTML = raw0_value;
			if (dirty[0] & /*editUserReply, completedRounds, marked*/ 139266) {
				each_value_2 = /*completedRounds*/ ctx[1].slice(0, -1);
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div1, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_2.length;
			}

			if ((!current || dirty[0] & /*completedRounds*/ 2) && raw1_value !== (raw1_value = /*marked*/ ctx[13](/*completedRounds*/ ctx[1][/*completedRounds*/ ctx[1].length - 1].slot.ask) + "")) p.innerHTML = raw1_value;			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_1(ctx);

			if (current_block_type_index === previous_block_index) {
				if (~current_block_type_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				}
			} else {
				if (if_block0) {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
				}

				if (~current_block_type_index) {
					if_block0 = if_blocks[current_block_type_index];

					if (!if_block0) {
						if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block0.c();
					} else {
						if_block0.p(ctx, dirty);
					}

					transition_in(if_block0, 1);
					if_block0.m(div3, null);
				} else {
					if_block0 = null;
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block0);
			current = true;
		},
		o(local) {
			transition_out(if_block0);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div6);
			destroy_each(each_blocks, detaching);

			if (~current_block_type_index) {
				if_blocks[current_block_type_index].d();
			}

			if (if_block1) if_block1.d();
		}
	};
}

// (598:10) {#if userReplyValues.length > 0}
function create_if_block_8(ctx) {
	let div;
	let p;
	let t0_value = /*userReplyValues*/ ctx[44].join(", ") + "";
	let t0;
	let t1;
	let svg;
	let path;
	let mounted;
	let dispose;

	function click_handler() {
		return /*click_handler*/ ctx[25](/*rewoundRoundIndex*/ ctx[46]);
	}

	return {
		c() {
			div = element("div");
			p = element("p");
			t0 = text(t0_value);
			t1 = space();
			svg = svg_element("svg");
			path = svg_element("path");
			attr(path, "d", "M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "class", "inline-block ml-3 h-5 w-5 text-gray-400 hover:text-gray-800");
			attr(svg, "viewBox", "0 0 20 20");
			attr(svg, "fill", "currentColor");
			attr(p, "class", "mx-4 border-b-2 border-gray-300 text-base inline-block hover:text-gray-800");
			attr(div, "id", "user-reply-buttons-completed");
			attr(div, "class", "mt-2");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, p);
			append(p, t0);
			append(p, t1);
			append(p, svg);
			append(svg, path);

			if (!mounted) {
				dispose = listen(p, "click", click_handler);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty[0] & /*completedRounds*/ 2 && t0_value !== (t0_value = /*userReplyValues*/ ctx[44].join(", ") + "")) set_data(t0, t0_value);
		},
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			dispose();
		}
	};
}

// (587:6) {#each completedRounds.slice(0, -1) as { slot, userReplyValues }
function create_each_block_2(ctx) {
	let div;
	let p;
	let raw_value = /*marked*/ ctx[13](/*slot*/ ctx[43].ask) + "";
	let t0;
	let t1;
	let if_block = /*userReplyValues*/ ctx[44].length > 0 && create_if_block_8(ctx);

	return {
		c() {
			div = element("div");
			p = element("p");
			t0 = space();
			if (if_block) if_block.c();
			t1 = space();
			attr(p, "id", "bot-ask-text-completed");
			attr(p, "class", "text-l mr-4 sm:mr-12 ");
			attr(div, "class", "flex flex-col text-gray-400 bg-white border-solid border border-gray-200 rounded-lg p-3");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, p);
			p.innerHTML = raw_value;
			append(div, t0);
			if (if_block) if_block.m(div, null);
			append(div, t1);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*completedRounds*/ 2 && raw_value !== (raw_value = /*marked*/ ctx[13](/*slot*/ ctx[43].ask) + "")) p.innerHTML = raw_value;
			if (/*userReplyValues*/ ctx[44].length > 0) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_8(ctx);
					if_block.c();
					if_block.m(div, t1);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			if (if_block) if_block.d();
		}
	};
}

// (729:43) 
function create_if_block_7(ctx) {
	let p;
	let t0;
	let t1;
	let t2;

	return {
		c() {
			p = element("p");
			t0 = text("Error: unsupported reply type of ");
			t1 = text(/*replyType*/ ctx[4]);
			t2 = text(" received");
			attr(p, "class", "my-2");
		},
		m(target, anchor) {
			insert(target, p, anchor);
			append(p, t0);
			append(p, t1);
			append(p, t2);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*replyType*/ 16) set_data(t1, /*replyType*/ ctx[4]);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (727:63) 
function create_if_block_6(ctx) {
	let p;

	return {
		c() {
			p = element("p");
			p.textContent = "End of conversation";
			attr(p, "class", "my-2");
		},
		m(target, anchor) {
			insert(target, p, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (698:50) 
function create_if_block_5(ctx) {
	let div;
	let input;
	let t0;
	let button;
	let t2;
	let span;
	let t3;
	let p;
	let t4;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			input = element("input");
			t0 = space();
			button = element("button");
			button.textContent = "Go";
			t2 = space();
			span = element("span");
			span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg>`;
			t3 = space();
			p = element("p");
			t4 = text(/*inputError*/ ctx[7]);
			attr(input, "type", "text");
			attr(input, "size", "50");
			attr(span, "class", "askIcon");
			attr(div, "class", "my-2");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, input);
			set_input_value(input, /*userText*/ ctx[6]);
			append(div, t0);
			append(div, button);
			append(div, t2);
			append(div, span);
			append(div, t3);
			append(div, p);
			append(p, t4);

			if (!mounted) {
				dispose = [
					listen(input, "input", /*input_input_handler*/ ctx[29]),
					listen(input, "keyup", /*keyup_handler*/ ctx[30]),
					listen(button, "click", /*handleTextInput*/ ctx[19]),
					listen(span, "click", /*click_handler_3*/ ctx[31])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*userText*/ 64 && input.value !== /*userText*/ ctx[6]) {
				set_input_value(input, /*userText*/ ctx[6]);
			}

			if (dirty[0] & /*inputError*/ 128) set_data(t4, /*inputError*/ ctx[7]);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (696:56) 
function create_if_block_4(ctx) {
	let multiselect;
	let current;

	multiselect = new MultiSelect({
			props: { replyOptions: /*replyOptions*/ ctx[2] }
		});

	multiselect.$on("message", /*multiReplySubmit*/ ctx[16]);

	return {
		c() {
			create_component(multiselect.$$.fragment);
		},
		m(target, anchor) {
			mount_component(multiselect, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const multiselect_changes = {};
			if (dirty[0] & /*replyOptions*/ 4) multiselect_changes.replyOptions = /*replyOptions*/ ctx[2];
			multiselect.$set(multiselect_changes);
		},
		i(local) {
			if (current) return;
			transition_in(multiselect.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(multiselect.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(multiselect, detaching);
		}
	};
}

// (663:54) 
function create_if_block_3(ctx) {
	let div1;
	let div0;
	let select;
	let t0;
	let button;
	let mounted;
	let dispose;
	let each_value_1 = /*replyOptions*/ ctx[2];
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			div1 = element("div");
			div0 = element("div");
			select = element("select");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t0 = space();
			button = element("button");
			button.textContent = "Done";
			attr(select, "class", "block w-full pl-2 pr-10 text-base font-medium border-gray-300 focus:outline-none focus:ring-primary-color sm:text-sm rounded-md");
			if (/*selectedReplyIndex*/ ctx[5] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[27].call(select));
			attr(div0, "class", "w-full sm:max-w-xs");
			attr(button, "type", "button");
			attr(button, "class", "mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent font-medium rounded-md sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm shadow-sm text-white bg-primary-color hover:bg-hover-color focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hover-color");
			attr(div1, "class", "sm:flex sm:items-center");
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, div0);
			append(div0, select);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(select, null);
			}

			select_option(select, /*selectedReplyIndex*/ ctx[5]);
			append(div1, t0);
			append(div1, button);

			if (!mounted) {
				dispose = [
					listen(select, "change", /*select_change_handler*/ ctx[27]),
					listen(button, "click", /*click_handler_2*/ ctx[28])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*replyOptions*/ 4) {
				each_value_1 = /*replyOptions*/ ctx[2];
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(select, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}

			if (dirty[0] & /*selectedReplyIndex*/ 32) {
				select_option(select, /*selectedReplyIndex*/ ctx[5]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div1);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (640:10) {#if replyType === slotTypeEnum.diagnostic || (replyType === slotTypeEnum.single && replyOptions[0] === BUILT_IN_REPLIES.done[0])}
function create_if_block_2(ctx) {
	let div1;
	let div0;
	let each_value = /*adaptRepliesToText*/ ctx[18](/*replyOptions*/ ctx[2]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div1 = element("div");
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div0, "class", "w-full sm:max-w-xs");
			attr(div1, "class", "sm:flex sm:items-center");
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div0, null);
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*singleReplyClick, adaptRepliesToText, replyOptions*/ 294916) {
				each_value = /*adaptRepliesToText*/ ctx[18](/*replyOptions*/ ctx[2]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div0, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div1);
			destroy_each(each_blocks, detaching);
		}
	};
}

// (673:18) {#each replyOptions as userReplyValue, userReplyIndex}
function create_each_block_1(ctx) {
	let option;
	let t_value = /*userReplyValue*/ ctx[39] + "";
	let t;
	let option_value_value;

	return {
		c() {
			option = element("option");
			t = text(t_value);
			option.__value = option_value_value = /*userReplyIndex*/ ctx[41];
			option.value = option.__value;
		},
		m(target, anchor) {
			insert(target, option, anchor);
			append(option, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*replyOptions*/ 4 && t_value !== (t_value = /*userReplyValue*/ ctx[39] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(option);
		}
	};
}

// (643:16) {#each adaptRepliesToText(replyOptions) as userReplyValue, userReplyIndex}
function create_each_block(ctx) {
	let button;
	let t0_value = /*userReplyValue*/ ctx[39] + "";
	let t0;
	let t1;
	let button_id_value;
	let mounted;
	let dispose;

	function click_handler_1() {
		return /*click_handler_1*/ ctx[26](/*userReplyValue*/ ctx[39], /*userReplyIndex*/ ctx[41]);
	}

	return {
		c() {
			button = element("button");
			t0 = text(t0_value);
			t1 = space();
			attr(button, "type", "button");
			attr(button, "class", "w-full inline-flex items-center justify-center px-4 py-2 border border-transparent font-medium rounded-md sm:w-auto sm:text-sm shadow-sm text-white bg-primary-color hover:bg-hover-color focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hover-color");
			attr(button, "id", button_id_value = "reply-" + /*userReplyIndex*/ ctx[41]);
		},
		m(target, anchor) {
			insert(target, button, anchor);
			append(button, t0);
			append(button, t1);

			if (!mounted) {
				dispose = listen(button, "click", click_handler_1);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty[0] & /*replyOptions*/ 4 && t0_value !== (t0_value = /*userReplyValue*/ ctx[39] + "")) set_data(t0, t0_value);
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (742:4) {#if showRestartButton}
function create_if_block_1(ctx) {
	let hr;
	let t;
	let div;

	return {
		c() {
			hr = element("hr");
			t = space();
			div = element("div");
			attr(hr, "class", "mt-4");
		},
		m(target, anchor) {
			insert(target, hr, anchor);
			insert(target, t, anchor);
			insert(target, div, anchor);
		},
		d(detaching) {
			if (detaching) detach(hr);
			if (detaching) detach(t);
			if (detaching) detach(div);
		}
	};
}

function create_fragment(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;

	const if_block_creators = [
		create_if_block,
		create_if_block_9,
		create_if_block_10,
		create_if_block_11,
		create_else_block
	];

	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*showBotUI*/ ctx[10] && !/*showUnfriendlyError*/ ctx[12]) return 0;
		if (/*showUnfriendlyError*/ ctx[12]) return 1;
		if (/*waitForStartNewConversation*/ ctx[0]) return 2;
		if (/*showLoadingWaitUI*/ ctx[11]) return 3;
		return 4;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

function setBotCosmetics(botCosmetics = {}) {
	const el = document.getElementById("botContainer");
	el.style.setProperty("--primary-color", botCosmetics.primaryColor);
	el.style.setProperty("--secondary-color", botCosmetics.secondaryColor);
	el.style.setProperty("--hover-color", botCosmetics.hoverColor);
	el.style.setProperty("--container-color", botCosmetics.containerBg);
	el.style.setProperty("--container-border-color", botCosmetics.containerBorderBg);
	el.style.fontFamily = botCosmetics.customerFont;
}

/* styleListItemsWithImages() => undefined
 * Remove styles (and therefore the bullets) from list items coming from
 * the marked render.
 * Enables users to render pretty images at top of each list item
 * and display them like product or topic cards.
 * Do this if the first element in the li is an
 * img, otherwise do nothing. Only select li elements that are children
 * of ul elements - we don't want to do this to <ol> diagnostic items -
 * seeing the numbering is useful as subsequent steps in history may refer back
 * to earlier ones. Must run after DOM updates. No return value.
 */
function styleListItemsWithImages() {
	// Apply mt-12 to all the li elements if they have an image at top
	let selector = `#conversationHistory ul > li img:first-child, 
                    #currentAsk ul > li img:first-child`;

	const imgs = document.querySelectorAll(selector);

	if (imgs.length > 0) {
		// If images appear as first children in a list item,
		// add margin-top and remove bullets
		imgs.forEach(img => img.style.marginTop = "3rem");

		// Apply list-none up chain from img => li => ul elements that contain
		// those images
		imgs.forEach(img => {
			img.parentElement.parentElement.style.listStyleType = "none";
		});
	}
}

function instance($$self, $$props, $$invalidate) {
	let { propBotConfig = null } = $$props;
	let { propGetConfigFromRemote = false } = $$props;
	let { localStorageKey } = $$props;
	let { waitForStartNewConversation = false } = $$props;

	// @rollup/plugin-commonjs enables the conversion to ES6 modules
	const marked = require('marked');

	/************ variables used in the UI/DOM **********/
	let localeString; // String: unicode locale string used for language specific sorting

	let completedRounds; // Object: populates conversation history in view
	let replyOptions; // Array of Strings: replies the user can select from
	let showReplyOptions; // boolean: true diplays the replyOptionsModal, false hides
	let replyType; // String: one of slotTypeEnum in BotConfig.js
	let selectedReplyIndex; // Integer: index of reply user selected in single select
	let userText = ""; // String: free text user input
	let inputError = ""; // String: error displayed for free text user input

	// String: if present, shows intro at beginning of frame's
	// presentation, before any slots get shown.
	let frameIntroduction = "";

	let UIError = ''; // error show in UI, e.g. if botConfig doesn't load or invalid

	// Show the conversation in the view. Will be true if botConfig and conversation
	// successfully loaded, false otherwise. If false usually an error condition
	// like botConfig failed to load OR waitForStartNewConversation is true so 
	// we only want to show UI if getBotConfig() loaded from localStorage.
	let showBotUI = waitForStartNewConversation ? false : true;

	// Show loading indicator when in process of fetching
	// botConfig from remote.
	let showLoadingWaitUI = false;

	// Show unfriendly error if loading botConfig or conversation fails.
	// If set to false, could be a bug, botConfig version issue, or some
	// other botConfig loading issue.
	let showUnfriendlyError = false;

	// Displays a restart conversation button if true.
	// Only needed for testing to restart the bot in a multi bot scenario like
	// in storybook. Real user doesn't have this situation, and can just click
	// edit on whatever userReply they want to change to rewind the bot.
	let showRestartButton = propBotConfig ? true : false;

	/********* Constants ******************/
	// Currently the page.support publisher is able to create botConfigs
	// for multiple frames. However this Bot.svelte component does 
	// not support multiple frames - it lacks a way to for the user to 
	// transition from one frame to another. So at UI load time we 
	// need to set currentFrame to the first frame in botConfig so that 
	// startNewConversation() knows which frame to execute. Frames
	// are keyed with a UUID assigned by the publisher, so botConfig has
	// a startFrameId property to tell us where to start. currentFrame is
	// set at botConfig load time in loadBotConfig();
	let currentFrame = null;

	/********* Lifecycle Event handling *************/
	// Responsible for all GUI loading scenarios in this component
	loadUI(propBotConfig, localStorageKey, propGetConfigFromRemote, waitForStartNewConversation);

	/* loadUI() => undefined
 * Load botConfig, conversation, and show view.
 * Args:
 *   localStorageKey: REQUIRED: String, unique to this bot
 *   propBotConfig: OPTIONAL: instance of BotConfig from state/BotConfig.js
 *   propGetConfigFromRemote: REQUIRED: Boolean true if BotConfig should
 *     be fetched from remote URL
 *   waitForStartNewConversation: REQUIRED: Boolean true if UI should NOT be
 *     loaded until startConversation() is called with a BotConfig argument.
 * Scenarios:
 *  a) Containing site wants to load Bot component but not display it until
 *     runBot() is called and (usually) a botConfig is passed in via
 *     startNewConversation().
 *     Args:
 *         propBotConfig: null
 *         waitForStartNewConversation: true
 *         propGetConfigFromRemote: true | false
 *     loadUI() should display nothing until startNewConversation() called.
 *     If there is a cached botConfig in localStorage it should be used. This
 *     covers the case where user refreshed page after startConversation() was
 *     called.
 *     waitForStartNewConversation: true allows <Bot> to be added to the DOM
 *     and a binding to <Bot> be avaliable to caller so it can be used. Without
 *     this option you get into a catch-22 where the component can't be rendered
 *     because it lacks a BotConfig (if no remote), but component has to be
 *     rendered for the loading code to get a binding to the component to call
 *     startNewConversation.
 *  b) Containing site wants to load Bot and start conversation at load time.
 *     loadUI() displays Bot at component load time. BotConfig can come from
 *     propBotConfig or remote.
 *     Args:
 *       propBotConfig: BotConfig object
 *       propGetConfigFromRemote: false
 *       waitForStartNewConversation: false
 *  c) NOT IMPLEMENTED: Containing site wants to load Bot and get botConfig from remote then
 *     start conversation. getConfigFromRemote should be true and a remote
 *     URL provided to Bot via a prop. NOT IMPLEMENTED YET. loadUI() displays
 *     Bot at start of conversation after remote fetch. Show spinner during
 *     remote fetch. TODO: change getConfigFromRemote into null | URL so
 *     caller can pass in as a prop to getBotConfig()
 *     Args:
 *      propBotConfig: null
 *      propGetConfigFromRemote: URL
 *      waitForStartNewConversation: false | true. If true startNewConversation
 *      should not pass in a BotConfig.
 *
 */
	async function loadUI(
		propBotConfig,
	localStorageKey,
	getConfigFromRemote,
	waitForStartNewConversation
	) {
		try {
			const botConfig = loadBotConfig(propBotConfig, getConfigFromRemote, localStorageKey, waitForStartNewConversation);

			if (botConfig) {
				let conversation = loadConversation(botConfig);
				$$invalidate(10, showBotUI = true);
				await tick();

				// setBotCosmetics requires the DOM in place and the conversation
				// object to set custom color and font properties
				setBotCosmetics(conversation.botCosmetics);
			} else if (!waitForStartNewConversation) {
				// no BotConfig and we are NOT waiting on caller to call
				// startNewConversation and pass in a BotConfig, so show error in UI. 
				// This generally shouldn't happen if no bugs and caller passed in all
				// the required props.
				throw new invalidBotConfig(`getBotConfig() failed to acquire a botConfig from localStorage
          and remote and waitForStartNewConversation prop was false`);
			}
		} catch(e) {
			console.log(`botconfig load error: ${e}`);
			$$invalidate(9, UIError = e);
			$$invalidate(12, showUnfriendlyError = true);
		}
	} // if we get here there is no botConfig, and waitForStartNewConversation
	// is true, so the if block in the html below should show nothing.

	/* loadBotConfig() => botConfig || null
 * Acquire a botConfig from wherever it can be found:
 * Args:
 *   botConfig: OPTIONAL: instance of botConfig, could be passed in from prop
 *     or startNewConversation(botConfig). Might be null.
 *   getConfigFromRemote: REQUIRED: bool: if true allows getting config from remote
 *     if not present in localStorage.
 *   localStorageKey: REQUIRED: key used to save botConfig to localStorage
 * Order of operation:
 *   1. if botConfig arg is present, use that and save to localStorage
 *   2. if botConfig arg not present and getConfigFromRemote is false, check
 *      localStorage and use that.  If not present in localStorage, error.
 *   3. if botConfig arg not present and getConfigFromRemote is true and
 *      not present in localStorage, go to remote. 
 * 
 *  Note that the caller of this function is responsible for raising errors
 *  if botConfig acquisition fails.
 */
	function loadBotConfig(botConfig, getConfigFromRemote, localStorageKey, waitForStartNewConversation) {
		if (botConfig && versionCompatible(botConfig.version)) {
			saveBotState(botConfig, localStorageKey); // given new botConfig so save to localStorage
			currentFrame = botConfig.startFrameId;
			return botConfig;
		} else {
			// show loading UI only if caller is ok with UI showing
			if (!waitForStartNewConversation) $$invalidate(11, showLoadingWaitUI = true);

			// get BotConfig from localStorage or remote if getConfigFromRemote is true
			botConfig = getBotConfig(false, getConfigFromRemote, localStorageKey, waitForStartNewConversation);

			$$invalidate(11, showLoadingWaitUI = false);

			if (botConfig) {
				currentFrame = botConfig.startFrameId;
				return botConfig;
			}
		}

		// if we get here, all routes to getting botConfig have failed - caller
		// should raise error dependending on scenario.
		return null;
	}

	/* loadConversation() => conversation object || null
 * Called when the website Bot is embedded in does a page load.
 * Populates view variables like completedRounds and accepted replies so the UI
 * can present the next slot. Uses existing conversation state. May start a
 * new conversation or resume existing one if none is in progress.
 *
 * Args:
 *   - botConfig: REQUIRED: instance of botConfig
 *   - getConfigFromRemote: REQUIRED: bool. if true, initConversation call here will
 *     try to get botConfig from remote if it doesn't find one in localStorage.
 *     See scenarios at top of this file for what to set to.
 *
 * Returns conversation object - mostly to enable setBotCosmetics() and
 * populates state in browser's localstorage and populates
 * UI variables to display.
 *
 */
	function loadConversation(botConfig) {
		if (!botConfig) {
			console.log(`Error calling loadConversation(): botConfig arg must be supplied`);
		} else {
			// get conversation from sessionStorage or if not present, by
			// creating a new conversation. Preserves existing conversation
			// across page loads.
			let conversation = getConversation(localStorageKey) || initConversation(botConfig, currentFrame, localStorageKey);

			if (conversation) {
				$$invalidate(8, frameIntroduction = conversation.introduction);
				localeString = conversation.localeString;
				populateConversationUI(); // set view variables
				$$invalidate(10, showBotUI = true); // false by default
				return conversation;
			} else {
				console.log("failed to load conversation in loadConversation()");
				$$invalidate(10, showBotUI = false);
				return null;
			}
		}
	}

	// After any DOM update (usually triggered by a variable here being updated
	// for instance the bot renders a say, run the listed functions.
	afterUpdate(() => {
		styleListItemsWithImages(); // apply non-default style to rendered markdown
	});

	/* startNewConversation(bot) => undefined
 * Start a new conversation from the beginning, stopping one if its running.
 * Populates all the needed view variables to display a conversation.
 *
 * Args: newBot : OPTIONAL is an instance of the botConfig object.
 *
 * Behavior WRT botConfig sourcing:
 *   1. use newBot if argument present.
 *   2. use propBotConfig if newBot === null (passed in from prop)
 *   3. try to get botConfig from localStorage
 *   4. try fetching botConfig from remote
 *   5. raise error if all that fails.
 */
	async function startNewConversation(newBot = null) {
		try {
			let botConf = loadBotConfig(newBot || propBotConfig, propGetConfigFromRemote, localStorageKey, waitForStartNewConversation);

			if (!botConf) {
				throw new invalidBotConfig(`startNewConversation() failed to acquire a botConfig from localStorage and remote.`);
			}

			let conversation = initConversation(botConf, currentFrame, localStorageKey);

			if (conversation) {
				localeString = conversation.localeString;
				$$invalidate(8, frameIntroduction = conversation.introduction);
				populateConversationUI(); // set view variables
				$$invalidate(10, showBotUI = true);
				await tick(); // wait for ui to show in DOM

				// set custom color and font properties in case user changed them in publisher mode
				setBotCosmetics(conversation.botCosmetics);
			} else {
				throw new invalidBotConfig(`startNewConversation() failed to acquire conversation objectfrom initConversation()`);
			}
		} catch(e) {
			console.log(`startNewConversation() botconfig error: ${e}`);
			$$invalidate(9, UIError = e);
			$$invalidate(12, showUnfriendlyError = true);
		}
	}

	/* populateConversationUI() => undefined
 * Populates UI variables needed to display a conversation:
 *  completedRounds, replyType, replyOptions
 */
	function populateConversationUI() {
		// empty the input box and error for free text entry in case reused
		$$invalidate(6, userText = "");

		$$invalidate(7, inputError = "");
		$$invalidate(1, { completedRounds, replyType, replyOptions } = getNextSlot(localStorageKey), completedRounds, $$invalidate(4, replyType), $$invalidate(2, replyOptions));
	}

	/***************** DOM EVENT handlers ***************/
	/* Handle user clicking button on a single reply ask */
	function singleReplyClick(userReplyStr, userReplyIndex) {
		saveReply({
			userReplyValues: [userReplyStr],
			userReplyIndexes: [userReplyIndex],
			ending: ENDINGS.completed,
			stats: {},
			localStorageKey
		});

		populateConversationUI(); // get next slot and update UI variables.
	}

	/* multiReplySubmit() => undefined
 * Handle user clicking 'done' on a multiple reply ask. The
 * argument will have an array of integers representing the replies
 * the user selected.
 * Args: REQUIRED: event :event from UI
 * See https://svelte.dev/tutorial/component-events for format
 */
	function multiReplySubmit(event) {
		const userReplyValues = event.detail.map(i => replyOptions[i]);

		saveReply({
			userReplyValues,
			userReplyIndexes: event.detail,
			ending: ENDINGS.completed,
			stats: {},
			localStorageKey
		});

		populateConversationUI(); // get next slot and update the UI.
	}

	/* editUserReply(rewoundRoundIndex: int) => undefined
 * When user clicks edit on a previously answered slot/round and saves it
 * this function is called to reset conversation history. It removes rounds
 * after this one and recomputes the next round, updating the view
 * accordingly. This implementation is simpler than updating the view after
 * the user answers the slot, because we can use the existing view code to
 * re-render the view reactively.  If we want to change the view update to after
 * the user answers the slot, we need new code and more componentization to
 * render the slot before the view updates.
 * Args:
 *   REQUIRED: rewoundRoundIndex is the index into completedRounds where the user is
 *   editing their answer.
 */
	function editUserReply(rewoundRoundIndex) {
		// modify conversation history to drop all userReplies after and
		// including this one
		rewindConversation(rewoundRoundIndex, false, localStorageKey);

		populateConversationUI(); // setup view for next slot
	}

	/* Placeholder for future free text entry
 * handleTextInput()
 * Take the string entered by the user in freeTextReply components
 * and handle it.
 * Uses userText value which is the string entered by the user
 *
function handleTextInput() {
  try {
    parseTextInput(userText);
  } catch (e) {
    inputError = e;
    console.log(e.stack);
  }
}

// handle keyup event on free text entry field for user reply
function enterKeyOnInput(event) {
  if (event.key === "Enter") {
    handleTextInput();
  }
}
*/
	/********** View Utilities ***********/
	// If replyOptions is the built in diagnostic 'done', don't need to offer
	// 'not done', just wait for done click since its a text UI
	function adaptRepliesToText(replyOptions) {
		if (replyOptions[0] === BUILT_IN_REPLIES.done[0]) {
			replyOptions = dropLast$1(1, replyOptions);
		}

		return replyOptions;
	}

	/* Placeholder for future free text entry
 * handleTextInput()
 * Take the string entered by the user in freeTextReply components
 * and handle it.
 * Uses userText value which is the string entered by the user
 */
	function handleTextInput() {
		try {
			parseTextInput(userText);
		} catch(e) {
			$$invalidate(7, inputError = e);
			console.log(e.stack);
		}
	}

	// handle keyup event on free text entry field for user reply
	function enterKeyOnInput(event) {
		if (event.key === "Enter") {
			handleTextInput();
		}
	}

	const click_handler = rewoundRoundIndex => editUserReply(rewoundRoundIndex);
	const click_handler_1 = (userReplyValue, userReplyIndex) => singleReplyClick(userReplyValue, userReplyIndex);

	function select_change_handler() {
		selectedReplyIndex = select_value(this);
		$$invalidate(5, selectedReplyIndex);
	}

	const click_handler_2 = () => singleReplyClick(replyOptions[selectedReplyIndex], selectedReplyIndex);

	function input_input_handler() {
		userText = this.value;
		$$invalidate(6, userText);
	}

	const keyup_handler = e => enterKeyOnInput(e);
	const click_handler_3 = () => $$invalidate(3, showReplyOptions = true);

	$$self.$$set = $$props => {
		if ('propBotConfig' in $$props) $$invalidate(21, propBotConfig = $$props.propBotConfig);
		if ('propGetConfigFromRemote' in $$props) $$invalidate(22, propGetConfigFromRemote = $$props.propGetConfigFromRemote);
		if ('localStorageKey' in $$props) $$invalidate(23, localStorageKey = $$props.localStorageKey);
		if ('waitForStartNewConversation' in $$props) $$invalidate(0, waitForStartNewConversation = $$props.waitForStartNewConversation);
	};

	return [
		waitForStartNewConversation,
		completedRounds,
		replyOptions,
		showReplyOptions,
		replyType,
		selectedReplyIndex,
		userText,
		inputError,
		frameIntroduction,
		UIError,
		showBotUI,
		showLoadingWaitUI,
		showUnfriendlyError,
		marked,
		showRestartButton,
		singleReplyClick,
		multiReplySubmit,
		editUserReply,
		adaptRepliesToText,
		handleTextInput,
		enterKeyOnInput,
		propBotConfig,
		propGetConfigFromRemote,
		localStorageKey,
		startNewConversation,
		click_handler,
		click_handler_1,
		select_change_handler,
		click_handler_2,
		input_input_handler,
		keyup_handler,
		click_handler_3
	];
}

class Bot extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance,
			create_fragment,
			safe_not_equal,
			{
				propBotConfig: 21,
				propGetConfigFromRemote: 22,
				localStorageKey: 23,
				waitForStartNewConversation: 0,
				startNewConversation: 24
			},
			null,
			[-1, -1]
		);
	}

	get startNewConversation() {
		return this.$$.ctx[24];
	}
}

export { Bot };
