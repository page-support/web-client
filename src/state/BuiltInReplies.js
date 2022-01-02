/* Built in Replies
 *
 * Markdown files read by the parser may refer to these
 * to avoid entering in a list of reply options
 * 
 * These take the same form as user-generated replies: the key is the 
 * unique name of the reply, the value is an array of Strings the user
 * may select from.
 */

export const BUILT_IN_REPLIES = {
    yes: ['yes', 'no'],
    true: ['true', 'false'],
    accept: ['accept', 'reject'],
    done: ['done', 'not done']
};



