/**
 * Listen to messages coming from content script
 */
chrome.runtime.onMessage.addListener(function (request, sender) {
    switch (request.type) {
        // A page with checksums and algorithm names has been opened.
        // Register all links on this page with those values.
        case "download":
            let tab = parseInt(sender.tab.id);
            let pageData = {
                request: request,
                urls: request.urls,
                checksum: request.checksum,
                tab: tab
            };
            // Get the current linkToMonitor array from storage
            chrome.storage.local.get('linkToMonitor', function(data) {
                let links = data.linkToMonitor || [];
                links.unshift(pageData);
                // Store the updated linkToMonitor array back to local storage
                chrome.storage.local.set({linkToMonitor: links});
            });
            break;
        // The delete link has been clicked on the popup
        case "remove":
            console.debug("asked to remove");
            //delete file
            chrome.downloads.removeFile(request.id);
            // Update popup warning
            chrome.tabs.sendMessage(sender.tab.id, {type: "deleted"});
            break;
        // A page containing checksums algo names and links to monitor has been notices, it will keep the background script running
        case "keepAlive":
            console.debug("Content request to keep alive");
            break;
        default:
            console.debug("Unknown request type: " + request.type);
            break;
    }

});

/******************************************************************************
 * Monitor downloads in order to share the user behaviour (try catch block)
 * Take care of launching checksum computation
 ******************************************************************************/
//Stop download on create, verify if download is dangerous complete dictionnary of dangerous download
chrome.downloads.onCreated.addListener(function (downloadItem) {
    console.debug("New download item:", downloadItem);
    // Get the linkToMonitor and downloads arrays from local storage
    chrome.storage.local.get(['linkToMonitor', 'downloads'], function(data) {
        let links = data.linkToMonitor || [];
        let downloads = data.downloads || {};
        // For every link we are currently monitoring,
        for (let link of links) {
            // if that link matches the URL of the file being downloaded,
            if (link.urls.includes(downloadItem.url) || link.urls.includes(downloadItem.finalUrl)) {
                console.debug("Current state of downloads before addition:", downloads);
                // store information about that download in the downloads array.
                downloads[downloadItem.id] = {
                    download: downloadItem.url,
                    checksum: link.checksum,
                    tab: link.tab,
                    completed: false
                };
                // Store the updated downloads array back to local storage.
                chrome.storage.local.set({downloads: downloads}, function() {
                    console.debug("Updated state of downloads after addition:", downloads);
                });
                // Let the content script know that a download has started.
                chrome.tabs.sendMessage(link.tab, {type: "downloading"});
                break;
            }
        }
    });
});

chrome.downloads.onChanged.addListener(function (download) {
    // Get the downloads array from local storage
    chrome.storage.local.get(['downloads'], function(result) {
        let downloads = result.downloads || {};
        // If the download that triggered this function is not being tracked,
        if (!(download.id in downloads)) {
            // the download was not registered 
            // (i.e., wasn't triggered from a download link detected by the extension)
            return;
        }
        let tab = downloads[download.id].tab;
        // If the download has completed, send a message to the content script.
        if (download.state && download.state.current === 'complete') {
            chrome.tabs.sendMessage(tab, {
                type: "downloadComplete", 
                downloadId: download.id,
                checksum: downloads[download.id].checksum
            });
        // Otherwise, if the download has been interrupted,
        } else if (download.state && download.state.current === 'interrupted') {
            // Delete the entry from the downloads array.
            delete downloads[download.id];
            // Store the updated download array back to local storage.
            chrome.storage.local.set({downloads: downloads});
        }
    });
});