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

// map global post numbers to local thread IDs.
var idMap = new Object;

function rearrangeExistingElements(post) {
    var headerCol   = document.createElement("div");
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
    if (name.textContent === "Anonymous" || postertrip.textContent !== "") {
        name.style.display = "none";
    }

    // move user name to back of dateTime span.
    nameBlock.parentNode.insertBefore(dateTime, nameBlock);

    // wrap postInfo in headerCol div.
    headerCol.classList.add("headerCol");
    headerCol.appendChild(postInfo);
    post.insertBefore(headerCol, postMessage);

    // wrap postMessage text inside new commentText span.
    var commentBody = document.createElement("div");
    var pmParent = postMessage.parentNode;
    commentBody.classList.add("commentBody");
    commentBody.appendChild(postMessage);
    pmParent.appendChild(commentBody);

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
        var imageHighlight = document.createElement("div");
        imageHighlight.classList.add("imageHighlight");
        imageHighlight.appendChild(postInfo);
        imageHighlight.appendChild(fileThumb);
        headerCol.appendChild(imageHighlight);
    }
}

function addLinkBox(post, type, contents) {
    var box = document.createElement("a");
    box.classList.add("linkBox");
    box.classList.add(type);
    box.textContent = contents;

    var postMessage = post.querySelector("div.commentBody");
    post.insertBefore(box, postMessage);
}

function sanitizeQuoteLinks(post) {
    var msg = post.querySelector("blockquote.postMessage");
    var quoteLink = /<a href="#p(\d+)" class="quotelink">.*<\/a>/;
    var htmlWhitespace = /(?:\s*<br>\s*)*/;

    var re = new RegExp(quoteLink.source + htmlWhitespace.source);
    var match = msg.innerHTML.match(re);

    if (match === null) {
        return;
    }

    msg.innerHTML = msg.innerHTML.replace(match[0], "");
    var target = post.querySelector("a.replyTarget");
    target.textContent = idMap[match[1]];
}

function getGlobalId(post) {
    return post.getAttribute("id").match(/\d+/);
}

function modifyPost(post, idx) {
    var gid = getGlobalId(post);
    idMap[gid] = idx;

    rearrangeExistingElements(post);
    addLinkBox(post, "postNo", idx);
    addLinkBox(post, "replyTarget", "");
    sanitizeQuoteLinks(post);
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
    demoteOp();

    var posts = document.querySelectorAll("div.post");
    for (var i = 0; i < posts.length; i++) {
        modifyPost(posts[i], i+1);
    }
}

main();
