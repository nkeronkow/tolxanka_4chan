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
    id: null,
    html: null,
    idMap: new Object,

    modifyPost: function(postContainer, idx) {
        var post = postContainer.querySelector("div.post");
        var gid = getGlobalId(post);
        this.idMap[gid] = idx;

        rearrangeExistingElements(post);
        addLinkColumn(post, idx);
        this.sanitizeQuoteLinks(post);
    },

    // modify all posts in thread. if a summary tag is encountered, the index
    // will skip ahead before doing all other posts after the first.
    modifyStructure: function() {
        demoteOp();
        var posts = this.html.querySelectorAll("div.postContainer");
        var summary = this.html.querySelector("span.summary");
        var offset = 1;

        // set thread id to post id of first post.
        this.id = getGlobalId(posts[0]);

        this.modifyPost(posts[0], 1);

        if (summary !== null) {
            var summaryBlock = newSummaryBlock(summary.innerHTML);
            posts[1].parentNode.insertBefore(summaryBlock, posts[1]);
            this.html.removeChild(summary);

            var match = summary.textContent.match(/(\d+) posts?.*omitted./);
            offset += match[1] | 0;
        }

        for (var i = 1; i < posts.length; i++) {
            this.modifyPost(posts[i], i + offset);
        }
    },

    sanitizeQuoteLinks: function(post) {
        var original = post.querySelector("blockquote.postMessage");
        var targetMsg = original;
        var replySection = post.querySelector("div.replySection");
        var sectionNo = 1;

        replySection.parentNode.removeChild(replySection);

        while (true) {
            var links = consumeLinks(original);
            var content = consumeMessage(original);

            if (links.length === 0 && content.length === 0) {
                break;
            }

            replySection = addReplySection(post);
            targetMsg = replySection.querySelector("blockquote.postMessage");
            content.map(function(n) { targetMsg.appendChild(n) });

            for (var i = 0; i < links.length; i++) {
                var link = links[i];
                var match = link.match(/(\d+)?#p(\d+)/);

                if (match[1] && match[1] !== this.id) {
                    this.idMap[link] = "↳";
                }

                var localId = this.idMap[match[2]];
                addReplyTarget(replySection, localId);
            }

            sectionNo++;
        }
    },
}

// generator to retrieve the next group of consecutive quotelinks in a post.
// ignores html linebreaks.
function consumeLinks(msgBody) {
    var links = new Array();
    var deletionArray = new Array();
    var n = msgBody.firstChild;

    for (; n; n = n.nextSibling) {
        if (n.nodeType === Node.ELEMENT_NODE) {
            if (n.tagName === "A" && n.classList.contains("quotelink")) {
                links.push(n.getAttribute("href"));
            } else if (n.tagName === "BR") {
                // do nothing.
            } else {
                break;
            }
        } else {
            break
        }

        deletionArray.push(n);
    }

    // alert("consumeLinks deleting " + deletionArray.length + " nodes.");
    deletionArray.map(function(n) { msgBody.removeChild(n) });
    return links;
}

// Consume all post contents up until a quotelink preceded by two consecutive
// <br> tags. 
function consumeMessage(msgBody) {
    var content = new Array();
    var deletionArray = new Array();
    var breaks = 0;
    var n = msgBody.firstChild;

    for (; n; n = n.nextSibling) {
        if (n.nodeType === Node.ELEMENT_NODE) {
            if  (n.tagName === "A" && n.classList.contains("quotelink") && breaks >= 2) {
                n = n.previousSibling;
                break;
            } else if (n.tagName === "BR") {
                breaks++;
            }
        }

        deletionArray.push(n);
        content.push(n);
    }

    deletionArray.map(function(n) { msgBody.removeChild(n) });
    return content;
}

function newThread(elem) {
    var t = Object.create(Thread);
    t.html = elem;
    return t;
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

function addReplyTarget(replySection, targetNo) {
    var linkWrapper = replySection.querySelector("div.linkWrapper");
    var replyTarget = newElem("a", "replyTarget", "linkBox");
    replyTarget.textContent = targetNo;
    linkWrapper.appendChild(replyTarget);
    return replyTarget;
}

function addLinkColumn(post, idx) {
    var postNo = newElem("a", "postNo", "linkBox");
    var sectionWrapper = newElem("div", "sectionWrapper");

    postNo.textContent = idx;
    post.appendChild(postNo);
    post.appendChild(sectionWrapper);
    addReplySection(post);
}

function addReplySection(post) {
    var sectionWrapper  = post.querySelector("div.sectionWrapper");
    var commentBody     = newElem("div", "commentBody");
    var replySection    = newElem("div", "replySection");
    var linkWrapper     = newElem("div", "linkWrapper");
    var postMessage     = newElem("blockquote", "postMessage");
    post.appendChild(sectionWrapper);
    sectionWrapper.appendChild(replySection);
    replySection.appendChild(linkWrapper);
    replySection.appendChild(commentBody);
    commentBody.appendChild(postMessage);
    return replySection;
}

function newSummaryBlock(content) {
    var postContainer   = newElem("div",        "postContainer");
    var post            = newElem("div",        "post");
    var headerCol       = newElem("div",        "headerCol");
    var commentBody     = newElem("div",        "commentBody");
    var postMessage     = newElem("blockquote", "postMessage");
    postContainer.classList.add("inlineSummary");
    postContainer.appendChild(post);
    post.appendChild(headerCol);
    post.appendChild(commentBody);
    commentBody.appendChild(postMessage);
    postMessage.innerHTML = content;
    addLinkColumn(post);
    return postContainer;
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
