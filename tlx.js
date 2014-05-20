// ==UserScript==
// @name        tolxanka-4chan
// @namespace   http://www.savru.net
// @description Alternate 4chan layout script
// @include     http://boards.4chan.org/*
// @include     https://boards.4chan.org/*
// @version     1
// @grant       none
// ==/UserScript==

"use strict";

var Thread = {
    idMap: new Object,
    thread: null,

    modifyPost: function(postContainer, idx) {
        var post = postContainer.querySelector("div.post");
        var gid = getGlobalId(post);
        this.idMap[gid] = idx;

        rearrangeExistingElements(post);
        addLinkBox(post, "postNo", idx);
        addLinkBox(post, "replyTarget", "");
        this.sanitizeQuoteLinks(post);
    },

    sanitizeQuoteLinks: function(post) {
        var msg = post.querySelector("blockquote.postMessage");
        var quoteLink = /<a href="#p(\d+)" class="quotelink">.*?<\/a>/;
        var htmlWhitespace = /(?:\s*<br>\s*)*/;

        var re = new RegExp(quoteLink.source + htmlWhitespace.source);
        var match = msg.innerHTML.match(re);

        if (match === null) {
            return;
        }

        msg.innerHTML = msg.innerHTML.replace(match[0], "");
        var target = post.querySelector("a.replyTarget");
        target.textContent = this.idMap[match[1]];
    },

    // modify all posts in thread. if a summary tag is encountered, the index
    // will skip ahead before doing all other posts after the first.
    modifyStructure: function() {
        demoteOp();
        var posts = this.thread.querySelectorAll("div.postContainer");
        var summary = this.thread.querySelector("span.summary");
        var offset = 1;

        this.modifyPost(posts[0], 1);

        if (summary !== null) {
            var summaryBlock = newSummaryBlock(summary.innerHTML);
            posts[1].parentNode.insertBefore(summaryBlock, posts[1]);
            this.thread.removeChild(summary);

            var match = summary.textContent.match(/(\d+) posts?.*omitted./);
            offset += match[1] | 0;
        }

        for (var i = 1; i < posts.length; i++) {
            this.modifyPost(posts[i], i + offset);
        }
    },
}

function newThread(thread) {
    var t = Object.create(Thread);
    t.thread = thread;
    return t;
}

function newSummaryBlock(content) {
    var postContainer   = newElem("div",        "postContainer");
    var post            = newElem("div",        "post");
    var headerCol       = newElem("div",        "headerCol");
    var postNo          = newElem("a",          "linkBox", "postNo");
    var replyTarget     = newElem("a",          "linkBox", "replyTarget");
    var commentBody     = newElem("div",        "commentBody");
    var postMessage     = newElem("blockquote", "postMessage");
    postContainer.classList.add("inlineSummary");
    postContainer.appendChild(post);
    post.appendChild(headerCol);
    post.appendChild(postNo);
    post.appendChild(replyTarget);
    post.appendChild(commentBody);
    commentBody.appendChild(postMessage);
    postMessage.innerHTML = content;
    return postContainer;
}

function newElem(type, className) {
    var e = document.createElement(type);
    for (var i = 1; i < arguments.length; i++) {
        e.classList.add(arguments[i]);
    }
    return e;
}


function rearrangeExistingElements(post) {
    var headerCol   = newElem("div", "headerCol");
    var postInfo    = post.querySelector("div.postInfo");
    var fileText    = post.querySelector("div.fileText");
    var fileThumb   = post.querySelector("a.fileThumb");
    var postMessage = post.querySelector("blockquote.postMessage");
    var subject     = postInfo.querySelector("span.subject");
    var dateTime    = postInfo.querySelector("span.dateTime");
    var nameBlock   = postInfo.querySelector("span.nameBlock");
    var name        = postInfo.querySelector("span.name");
    var postertrip  = postInfo.querySelector("span.postertrip");

    // Do not display names for "Anonymous" posters or tripcode users.
    if (name.textContent === "Anonymous" || postertrip !== null) {
        name.style.display = "none";
    }

    // move user name to back of dateTime span.
    nameBlock.parentNode.insertBefore(dateTime, nameBlock);

    // wrap postInfo in headerCol div.
    headerCol.appendChild(postInfo);
    post.insertBefore(headerCol, postMessage);

    // wrap postMessage text inside new commentText span.
    var commentBody = newElem("div", "commentBody");
    var pmParent = postMessage.parentNode;
    commentBody.appendChild(postMessage);
    pmParent.appendChild(commentBody);

    // move subject line to comment div.
    if (subject !== null) {
        postMessage.parentNode.insertBefore(subject, postMessage);
    }

    // move image info line to comment div.
    if (fileText !== null) {
        postMessage.parentNode.insertBefore(fileText, postMessage);
    }

    // if post has an image, create imageHighlight, then nest filethumb inside
    // imageHighlight, inside headerCol. Move postInfo inside imageHighlight.
    if (fileThumb !== null) {
        var imageHighlight = newElem("div", "imageHighlight");
        imageHighlight.appendChild(postInfo);
        imageHighlight.appendChild(fileThumb);
        headerCol.appendChild(imageHighlight);
    }
}

function addLinkBox(post, type, contents) {
    var box = newElem("a", "linkBox", type);
    box.textContent = contents;

    var postMessage = post.querySelector("div.commentBody");
    post.insertBefore(box, postMessage);
}

function getGlobalId(post) {
    return post.getAttribute("id").match(/\d+/);
}

function demoteOp() {
    var op = document.querySelector("div.op");
    var opCon = document.querySelector("div.opContainer");
    op.classList.remove("op");
    op.classList.add("reply");
    opCon.classList.remove("opContainer");
    opCon.classList.add("replyContainer");
}

function main() {
    var threads = document.querySelectorAll("div.thread");
    for (var i = 0; i < threads.length; i++) {
        var thread = newThread(threads[i]);
        thread.modifyStructure();
    }
}

main();
