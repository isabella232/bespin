/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied.
 * See the License for the specific language governing rights and
 * limitations under the License.
 *
 * The Original Code is Bespin.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bespin Team (bespin@mozilla.com)
 *
 * ***** END LICENSE BLOCK ***** */

// = JavaScript Syntax Highlighting Implementation =
//
// Module for syntax highlighting JavaScript.

if (typeof Bespin == "undefined") Bespin = {};
if (!Bespin.Syntax) Bespin.Syntax = {};

// ** {{{ Bespin.Syntax.JavaScriptSyntaxEngine }}} **
//
// Tracks syntax highlighting data on a per-line basis. This is a quick-and-dirty implementation that
// supports five basic highlights: keywords, punctuation, strings, comments, and "everything else", all
// lumped into one last bucket.

Bespin.Syntax.JavaScriptConstants = {
    C_STYLE_COMMENT: "c-comment",
    LINE_COMMENT: "comment",
    STRING: "string",
    KEYWORD: "keyword",
    PUNCTUATION: "punctuation",
    OTHER: "plain"
}

Bespin.Syntax.JavaScriptSyntaxEngine = Class.create({
    keywords: 'abstract boolean break byte case catch char class const continue debugger ' +
                    'default delete do double else enum export extends false final finally float ' +
                    'for function goto if implements import in instanceof int interface long native ' +
                    'new null package private protected public return short static super switch ' +
                    'synchronized this throw throws transient true try typeof var void volatile while with'.split(" "),

    punctuation: '{ } / + - % * . , ; ( ) ? : = " \''.split(" "),

    highlight: function(line, meta) {
        var jsc = Bespin.Syntax.JavaScriptConstants;    // aliasing the constants for shorter reference ;-)

        var regions = {};                               // contains the individual style types as keys, with array of start/stop positions as value

        // current state, maintained as we parse through each character in the line; values at any time should be consistent
        var currentStyle = (meta.inMultilineComment) ? jsc.C_STYLE_COMMENT : undefined;
        var currentRegion = {}; // should always have a start property for a non-blank buffer
        var buffer = "";

        // these properties are related to the parser state above but are special cases
        var stringChar = "";    // the character used to start the current string
        var multiline = meta.inMultilineComment;  // this line contains an unterminated multi-line comment

        for (var i = 0; i < line.length; i++) {
            var c = line.charAt(i);

            // check if we're in a comment and whether this character ends the comment
            if (currentStyle == jsc.C_STYLE_COMMENT) {
                if (c == "/" && buffer.endsWith("*")) { // has the c-style comment just ended?
                    currentRegion.stop = i;
                    this.addRegion(regions, currentStyle, currentRegion);
                    currentRegion = {};
                    currentStyle = undefined;
                    multiline = false;
                    buffer = "";
                } else {
                    if (buffer == "") currentRegion = { start: i };
                    buffer += c;
                }

                continue;
            }

            if (this.isWhiteSpaceOrPunctuation(c)) {
                // check if we're in a string
                if (currentStyle == jsc.STRING) {
                    // if this is not an unescaped end quote (either a single quote or double quote to match how the string started) then keep going
                    if ( ! (c == stringChar && !buffer.endsWith("\\"))) {
                        if (buffer == "") currentRegion = { start: i };
                        buffer += c;
                        continue;
                    }
                }

                // if the buffer is full, add it to the regions
                if (buffer != "") {
                    currentRegion.stop = i;

                    if (currentStyle != jsc.STRING) {   // if this is a string, we're all set to add it; if not, figure out if its a keyword
                        if (this.keywords.indexOf(buffer) != -1) {
                            // the buffer contains a keyword
                            currentStyle = jsc.KEYWORD;
                        } else {
                            currentStyle = jsc.OTHER;
                        }
                    }
                    this.addRegion(regions, currentStyle, currentRegion);
                    currentRegion = {};
                    stringChar = "";
                    buffer = "";
                    // i don't clear the current style here so I can check if it was a string below
                }

                if (this.isPunctuation(c)) {
                    if (c == "*" && i > 0 && (line.charAt(i - 1) == "/")) {
                        // remove the previous region in the punctuation bucket, which is a forward slash
                        regions[jsc.PUNCTUATION].pop();

                        // we are in a c-style comment
                        multiline = true;
                        currentStyle = jsc.C_STYLE_COMMENT;
                        currentRegion = { start: i - 1 };
                        buffer = "/*";
                        continue;
                    }

                    // check for a line comment; this ends the parsing for the rest of the line
                    if (c == '/' && i > 0 && (line.charAt(i - 1) == '/')) {
                        currentRegion = { start: i - 1, stop: line.length };
                        currentStyle = jsc.LINE_COMMENT;
                        this.addRegion(regions, currentStyle, currentRegion);
                        buffer = "";
                        currentStyle = undefined;
                        currentRegion = {};
                        break;      // once we get a line comment, we're done!
                    }

                    // add an ad-hoc region for just this one punctuation character
                    this.addRegion(regions, jsc.PUNCTUATION, { start: i, stop: i + 1 });
                }

                // find out if the current quote is the end or the beginning of the string
                if ((c == "'" || c == '"') && (currentStyle != jsc.STRING)) {
                    currentStyle = jsc.STRING;
                    stringChar = c;
                } else {
                    currentStyle = undefined;
                }

                continue;
            }

            if (buffer == "") currentRegion = { start: i };
            buffer += c;
        }

        // check for a trailing character inside of a string or a comment
        if (buffer != "") {
            if (!currentStyle) currentStyle = jsc.OTHER;
            currentRegion.stop = line.length;
            this.addRegion(regions, currentStyle, currentRegion);
        }

        return regions;
    },

    addRegion: function(regions, type, data) {
        if (!regions[type]) regions[type] = [];
        regions[type].push(data);
    },

    isWhiteSpaceOrPunctuation: function(char) {
        return this.isPunctuation(char) || this.isWhiteSpace(char);
    },

    isPunctuation: function(char) {
        return this.punctuation.indexOf(char) != -1;
    },

    isWhiteSpace: function(char) {
        return char == " ";
    }
});

// TODO: register this puppy