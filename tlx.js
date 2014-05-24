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

        addLinkColumn(post, idx);
        this.sanitizeQuoteLinks(post);
        rearrangeExistingElements(post);
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
        var sectionNo = 0;

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
                if (link === "DEAD_LINK") {
                    addReplyTarget(replySection, "✖");
                } else {
                    var match = link.match(/(\d+)?#p(\d+)/);

                    if (match[1] && match[1] !== this.id) {
                        this.idMap[link] = "↳";
                    }

                    var localId = this.idMap[match[2]];
                    addReplyTarget(replySection, localId);
                }
            }

            sectionNo++;
        }

        // add empty reply section for textless posts.
        if (sectionNo === 0) {
            replySection = addReplySection(post);
        }

        original.parentNode.removeChild(original);
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
            } else if (n.tagName === "SPAN" &&
                            n.classList.contains("deadlink")) {

                links.push("DEAD_LINK");

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

    deletionArray.map(function(n) { msgBody.removeChild(n) });
    return links;
}

// Consume all post contents up until a quotelink preceded by two consecutive
// <br> tags. Remove any trailing <br> tags at the end.
function consumeMessage(msgBody) {
    var content = new Array();
    var deletionArray = new Array();
    var nextLinkCluster = new Array();
    var breaks = 0;
    var n = msgBody.firstChild;

    for (; n; n = n.nextSibling) {
        if (n.nodeType === Node.ELEMENT_NODE) {
            if  (n.tagName === "A" && n.classList.contains("quotelink") && breaks >= 2) {
                nextLinkCluster.push(n);
                continue;
            } else if (n.tagName === "BR") {
                breaks++;
            }

        // If new content is found after the next link cluster, ignore what
        // we've acculumated and break, leaving everything for the future
        // calls of consumeXXXX functions.
        } else if (nextLinkCluster.length > 0 ) {
            var nextLinkCluster = new Array();
            break;
        } else {
            breaks = 0;
        }

        deletionArray.push(n);
        content.push(n);
    }

    // If we fall off the end and nextLinkCluster has any contents, this post
    // has trailing links. The poster is not replying to these but is instead
    // only citing them. Treat them as normal content.
    if (nextLinkCluster.length > 0) {
        deletionArray = deletionArray.concat(nextLinkCluster);
        content = content.concat(nextLinkCluster);
    }

    while   (content.length > 0 &&
                content[content.length - 1].nodeType === Node.ELEMENT_NODE &&
                    content[content.length - 1].tagName === "BR") {
        content.pop();
    }

    deletionArray.map(function(n) { msgBody.removeChild(n) });
    return content;
}

/*
// Consume all post contents up until a quotelink preceded by two consecutive
// <br> tags. Remove any trailing <br> tags at the end.
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
        } else {
            breaks = 0;
        }

        deletionArray.push(n);
        content.push(n);
    }

    while   (content.length > 0 &&
                content[content.length - 1].nodeType === Node.ELEMENT_NODE &&
                    content[content.length - 1].tagName === "BR") {
        content.pop();
    }

    deletionArray.map(function(n) { msgBody.removeChild(n) });
    return content;
}
*/

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
    var fileThumb   = post.querySelector(".fileThumb");
    var linkBox     = post.querySelector("a.linkBox");
    var commentBody = post.querySelector("div.commentBody");
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
    post.insertBefore(headerCol, linkBox);

    // move subject line to commentBody div.
    if (subject !== null) {
        commentBody.insertBefore(subject, commentBody.firstChild);
    }

    // move image info line to commentBody div.
    if (fileText !== null) {
        commentBody.insertBefore(fileText, commentBody.firstChild);
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
    var sectionWrapper  = newElem("div",        "sectionWrapper");
    postContainer.classList.add("inlineSummary");
    postContainer.appendChild(post);
    post.appendChild(headerCol);
    post.appendChild(sectionWrapper);

    addLinkColumn(post);
    post.querySelector("blockquote.postMessage").innerHTML = content;
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
