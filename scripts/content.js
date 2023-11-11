const REGEXP_CHECKSUM_VALUE = /(?:[a-f0-9]{32,}|[A-F0-9]{32,})/g;
const CHECKSUM_VALUE_SIZE = [32, 40, 56, 64, 96, 128];
const REGEXP_CHECKSUM_ALGO = /((sha|SHA)(\s*-?\s*)(1|256|2|384|512)|((md|MD)5))/g;
const DANGEROUS_EXTENSIONS = ["dmg", "exe", "msi", "pkg", "iso", "zip", "tar.xz", "tar.gz", "tar.bz2", "tar", "deb", "rpm"];

const CHECKSUM_TYPE_MD5 = 'md5';
const CHECKSUM_TYPE_SHA1 = 'sha1';
const CHECKSUM_TYPE_SHA256 = 'sha256';
const CHECKSUM_TYPE_SHA384 = 'sha384';
const CHECKSUM_TYPE_SHA512 = 'sha512';

const MSG_HIDE = '<span id="msg_hide" style="width: 100%; float: right;"><i class="fas fa-times" style="color: rgb(95, 99, 105);"></i></span>';
const CLASS_HIGHLIGHTED_CHECKSUM = "highlighted_checksum";

const ONE_GB = 1 * 1024 * 1024 * 1024;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract pattern from a DOM element.
 *
 * @param elem          HTML Node to start the research.
 * @param pattern       Regex to find in node.
 * @param root          Used for the recursion.
 * @returns {Set<string>}  Set of element(s) matching the pattern
 */
function extractPattern(elem, pattern, root = false) {
    try {
        let checksumValues = new Set();
        if (elem.children.length === 0 || root) {
            if (elem.nodeName !== "SCRIPT" &&
                elem.nodeName !== "STYLE" &&
                elem.nodeName !== "NOSCRIPT"
            ) {
                while ((r = pattern.exec(elem.innerText)) !== null) {
                    checksumValues.add(r[0].toLowerCase().replace('-', ''));
                }
            }
        }
        for (child of elem.children) {
            for (c of extractPattern(child, pattern)) {
                checksumValues.add(c);
            }
        }
        return checksumValues;
    } catch (e) {
        console.debug("Error in reading inner text of element. \n" +
            "Error: " + e.toString());
        return new Set()

    }

}

function diversity(checksum, limit) {
    let set = new Set();
    for (char of checksum) {
        set.add(char);
    }

    return (set.size > limit);
}

function hasMix(elem) {
    const letters = /([a-f]|[A-F])/;
    const numbers = /([0-9])/;
    return letters.test(elem) && numbers.test(elem);
}

function filter(set) {
    const checksumValues = new Set();
    for (let elem of set) {
        if (CHECKSUM_VALUE_SIZE.includes(elem.length)) {
            if (hasMix(elem)) {
                if (diversity(elem, 10)) {
                    checksumValues.add(elem)
                }
            }
        }
    }
    return checksumValues
}

function isExtensionDangerous(filename) {
    return DANGEROUS_EXTENSIONS.reduce((acc, x) => acc || filename.endsWith(x), false);
}


/**
 * Inspect the page for download links and for checksum values and algorithms.
 * Send this data to the service worker.
 * 
 * @returns {Promise<void>}
 */
async function inspectPageAndSendInfo() {
    // Wait for site JS to load all content
    await sleep(200);

    // Detect checksum values in the page
    const checksumValues = filter(extractPattern(document.body, REGEXP_CHECKSUM_VALUE, true));
    // Detect checksum algorithms in the page
    const checksumAlgos = extractPattern(document.body, REGEXP_CHECKSUM_ALGO, true);

    console.debug(checksumValues);
    console.debug(checksumAlgos);

    // If there are any checksum values,
    if (checksumValues.size !== 0) {
        let urls = [];
        // Store the URL of the download.
        document.querySelectorAll("a").forEach(function (link) {
            if (link.hasAttribute("href") && isExtensionDangerous(link.href)) {
                urls.push(link.href);
            }
        });
        // If there are any download URLs,
        if (urls.length !== 0) {
            const checksum = {
                type: [...checksumAlgos],
                value: [...checksumValues],
            };

            console.debug(urls);
            console.debug(checksum);
            // Pass this data to the service worker.
            chrome.runtime.sendMessage({
                type: "download",
                urls: urls,
                checksum: checksum,
            });
        }
    }
}

inspectPageAndSendInfo();


/******************************************************************************
 * Create shadow DOM to display popup
 ******************************************************************************/

let mask_ = document.createElement("div");
let shadow = mask_.attachShadow({mode: 'open'});

let mask = document.createElement("div");
mask.id = 'mask';
mask.style.display = 'none';

let style = document.createElement('style');
fetch(chrome.runtime.getURL('css/bootstrap.min.css'), {method: 'GET'}).then(response => response.text().then(data => style.textContent += data));
fetch(chrome.runtime.getURL('css/style.css'), {method: 'GET'}).then(response => response.text().then(data => style.textContent += data));
fetch(chrome.runtime.getURL('css/fontawesome-all.css'), {method: 'GET'}).then(response => response.text().then(data => style.textContent += data));

shadow.appendChild(style);

let popup = document.createElement("div");
popup.id = 'popup';

let popup_head = document.createElement("div");
popup_head.style.width = "100%";
popup_head.style.height = "20px";

let acv_logo = document.createElement("img");
const acv_logo_size = "64px";
acv_logo.classList.add("rounded");
acv_logo.alt = "ACV logo";
acv_logo.style.cssFloat = "left";
acv_logo.src = chrome.runtime.getURL('icons/acv-logo.png');
acv_logo.style.height = acv_logo_size;
acv_logo.style.width = acv_logo_size;

let hide_link = document.createElement("a");
hide_link.style.cssFloat = "right";
hide_link.id = 'hide';
hide_link.href = '#';
hide_link.innerHTML = MSG_HIDE;
hide_link.onclick = makeHideFunction(mask);

popup_head.appendChild(acv_logo);
popup_head.appendChild(hide_link);

let fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.id = "fileUpload";
fileInput.style.display = "none";

let uploadButton = document.createElement("button");
uploadButton.innerHTML = "Upload for Verification";
uploadButton.style.display = "none";
uploadButton.style.marginTop = "10px";
uploadButton.onclick = function() {
    fileInput.click();
};

let buttonWrapper = document.createElement("div");
buttonWrapper.style.display = 'flex';           // Set the buttonWrapper div as a flex container
buttonWrapper.style.flexDirection = 'column';   // Stack children vertically
buttonWrapper.style.alignItems = 'center';      // Center children horizontally
buttonWrapper.style.justifyContent = 'center';  // Center children vertically

buttonWrapper.appendChild(uploadButton);


let title = document.createElement("div");
title.className = 'title';
title.innerHTML = chrome.i18n.getMessage("contentPopupTitle");

let content = document.createElement("div");
content.className = 'content';
content.innerHTML = '<p id="details"><p><p id="status">' +
    chrome.i18n.getMessage("contentPopupStatus") +
    '<img src="' + chrome.runtime.getURL("icons/icon16.png") + '" alt="Icon of the plugin"></p>';

content.appendChild(fileInput);
content.appendChild(buttonWrapper);

popup.appendChild(popup_head);
popup.appendChild(title);
popup.appendChild(content);

mask.appendChild(popup);
shadow.appendChild(mask);
try {
    document.body.appendChild(mask_);
} catch (e) {
    console.debug("Error in appending shadow DOM: " + e.toString());
}


/******************************************************************************
 * Display info in window
 ******************************************************************************/

// Highlight checksum in webpage
function highlightPattern(elem, pattern) {
    for (child of elem.children) {
        highlightPattern(child, pattern);
    }
    if (elem.children.length === 0) {
        innerHTML = elem.innerHTML;
        elem.innerHTML = elem.innerHTML.replace(pattern, x => '<span class=' + CLASS_HIGHLIGHTED_CHECKSUM + '>' + x + '</span>');
        if (innerHTML !== elem.innerHTML) { //replace has modified the element (i.e., it contains the checksum)
            makeVisible(elem);
        }
    }
}

// Remove highlighting tags
function cancelHighlight(elem = document.body) {
    for (child of elem.children) {
        cancelHighlight(child);
    }
    if (elem.className === CLASS_HIGHLIGHTED_CHECKSUM) {
        elem.className = '';
    }
}

function makeVisible(elem) {
    if (window.getComputedStyle(elem).display === 'none') {
        elem.style.display = 'initial';
    }
    if (elem.parentElement !== null) {
        makeVisible(elem.parentElement);
    }
}

function makeHideFunction(e) {
    return function () {
        e.style.display = 'none';
        cancelHighlight();
        return false;
    }
}

// Send request to background to delete downloaded file
function deleteFile(id) {
    chrome.runtime.sendMessage({
        type: "remove",
        id: id
    });
}


// Listen to the background process
chrome.runtime.onMessage.addListener(function (request) {
    let mask = shadow.getElementById('mask');
    let status = shadow.getElementById('status');

    switch (request.type) {
        case "downloading":
            cancelHighlight();
            title.innerHTML = chrome.i18n.getMessage("popupTitle");
            status.innerHTML = chrome.i18n.getMessage("popupDetails") + chrome.i18n.getMessage("popupStatusDownloading");
            mask.style.display = 'block';
            break;
        case "downloadComplete":
            chrome.i18n.getMessage("popupTitle");
            status.innerHTML = chrome.i18n.getMessage("popupStatusUploadPrompt");
            uploadButton.style.display = "block";
            mask.style.display = 'block';

            fileInput.addEventListener("change", handleFileChange = function() {
                if (this.files.length > 0) {
                    verifyFile(this.files[0], request.checksum, request.downloadId); 
                }
            });
            break;  
        case "deleted":
            status.innerHTML = chrome.i18n.getMessage("popupStatusDeleted");
            mask.style.display = 'block';
            break;
        case "error":
            console.debug("Error: " + request.message);
            break;
        default:
            console.debug("Unknown message: " + request.type);
            return;
    }
});

async function verifyFile(file, checksum, downloadId) {
    let mask = shadow.getElementById('mask');
    let status = shadow.getElementById('status');

    // Implement the "computing" style.
    uploadButton.style.display = 'none';
    title.innerHTML = chrome.i18n.getMessage("popupTitle");
    status.innerHTML = chrome.i18n.getMessage("popupDetails") + chrome.i18n.getMessage("popupStatusComputing");
    mask.style.display = 'block';

    console.debug("Uploaded file name:", file.name);
    console.debug("Uploaded file size:", file.size + " bytes");

    try {
        // Check if CryptoJS is loaded
        if (typeof CryptoJS === 'undefined') {
            throw new Error("CryptoJS is required and was not found.");
        }

         // Store the checksum data as local variables.
        const checksum_types = checksum.type;
        const checksum_value_actual = new Set(checksum.value);
        const checksum_value_computed = new Set();

        let checksum_result;
        // For all types of checksum algorithms detected on the page,
        for (let checksum_type of checksum_types) {
            // calculate those checksums according to that algorithm on the given file.
            switch (checksum_type.toLowerCase().replace('-', '').replace(' ', '')) {
                case CHECKSUM_TYPE_MD5:
                    console.debug("md5");
                    checksum_result = await computeMD5(file);
                    break;
                case CHECKSUM_TYPE_SHA1:
                    console.debug("sha1");
                    checksum_result = await computeSHA1(file);
                    break;
                case CHECKSUM_TYPE_SHA256:
                    console.debug("sha2");
                    checksum_result = await computeSHA256(file);
                    console.debug("Computed SHA-256 checksum:", checksum_result);
                    break;
                case CHECKSUM_TYPE_SHA384:
                    console.debug("sha384");
                    checksum_result = await computeSHA384(file);
                    break;
                case CHECKSUM_TYPE_SHA512:
                    console.debug("sha512");
                    checksum_result = await computeSHA512(file);
                    break;
                default:
                    console.debug("An error has occured while computing the checksum: Unknown checksum type '" + checksum_type + "'");
                    continue;
            }
            // Store the computed checksum
            checksum_value_computed.add(checksum_result);
        }
        // The checksums are valid if the given and computed checksums match.
        const valid = new Set([...checksum_value_computed].filter(x => checksum_value_actual.has(x))).size > 0;

        console.debug(checksum_value_actual);
        console.debug(checksum_value_computed)
        console.debug(valid);

        // If they are valid,
        if (valid) {
            // Apply the "safe" styling to the popup.
            highlightPattern(document.body, new RegExp([...checksum_value_computed].join('|'), "gi"));
            title.innerHTML = chrome.i18n.getMessage("contentPopupTitleSafe");
            status.innerHTML = chrome.i18n.getMessage("popupStatusValid");
        // Otherwise,
        } else {
            // Apply the "unsafe" styling to the popup.
            title.innerHTML = chrome.i18n.getMessage("contentPopupTitleUnsafe");
            status.innerHTML = chrome.i18n.getMessage("popupStatusInvalid");
            //shadow.getElementById("adanger").onclick = openPrivateTab;
            // If the user wants to delete the file,
            shadow.getElementById("delete").onclick = function () {
                // delete the file.
                deleteFile(downloadId);
            };
        }
    } catch (error) {
        // Handle other errors
        console.error("An error occurred:", error.message);
        title.innerHTML = "Error";
        status.innerHTML = "An unexpected error occurred.";
        mask.style.display = 'block';
    } finally {
        // Regardless of success or error, remove the download from local storage
        chrome.storage.local.get(['downloads'], function(result) {
            let downloads = result.downloads || {};
            if (downloadId in downloads) {
                delete downloads[downloadId];
                chrome.storage.local.set({downloads: downloads});
            }
        });
    }
}

async function processChunk(chunk, workingHash) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            const wordsCount = Math.ceil(arrayBuffer.byteLength / 4);
            let words = [];
            for (let i = 0; i < wordsCount; i++) {
                words[i] = (
                    (uint8Array[i * 4] << 24) |
                    (uint8Array[i * 4 + 1] << 16) |
                    (uint8Array[i * 4 + 2] << 8) |
                    (uint8Array[i * 4 + 3])
                ) >>> 0;
            }
            const wordArray = CryptoJS.lib.WordArray.create(words, arrayBuffer.byteLength);
            workingHash.update(wordArray);
            const incrementalHash = workingHash.clone().finalize().toString(CryptoJS.enc.Hex);
            console.debug("Incremental hash:", incrementalHash);
            resolve();
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(chunk);
    });
}

async function computeMD5(file) {
    let workingHash = CryptoJS.algo.MD5.create();
    const chunkSize = 1024 * 1024; // 1MB chunks
    let offset = 0;
    while (offset < file.size) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        await processChunk(chunk, workingHash);
        offset += chunkSize;
    }
    return workingHash.finalize().toString(CryptoJS.enc.Hex);
}

async function computeSHA1(file) {
    let workingHash = CryptoJS.algo.SHA1.create();
    const chunkSize = 1024 * 1024; // 1MB chunks
    let offset = 0;
    while (offset < file.size) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        await processChunk(chunk, workingHash);
        offset += chunkSize;
    }
    return workingHash.finalize().toString(CryptoJS.enc.Hex);
}

async function computeSHA256(file) {
    let workingHash = CryptoJS.algo.SHA256.create();
    const chunkSize = 1024 * 1024; // 1MB chunks
    let offset = 0;
    while (offset < file.size) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        await processChunk(chunk, workingHash);
        offset += chunkSize;
    }
    return workingHash.finalize().toString(CryptoJS.enc.Hex);
}

async function computeSHA384(file) {
    let workingHash = CryptoJS.algo.SHA384.create();
    const chunkSize = 1024 * 1024; // 1MB chunks
    let offset = 0;
    while (offset < file.size) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        await processChunk(chunk, workingHash);
        offset += chunkSize;
    }
    return workingHash.finalize().toString(CryptoJS.enc.Hex);
}

async function computeSHA512(file) {
    let workingHash = CryptoJS.algo.SHA512.create();
    const chunkSize = 1024 * 1024; // 1MB chunks
    let offset = 0;
    while (offset < file.size) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        await processChunk(chunk, workingHash);
        offset += chunkSize;
    }
    return workingHash.finalize().toString(CryptoJS.enc.Hex);
}

// Compute SHA digest for the downloaded file
function hash(algo, buffer) {
    return crypto.subtle.digest(algo, buffer).then(function (hash) {
        return Array.from(new Uint8Array(hash)).map(b => ('00' + b.toString(16)).slice(-2)).join('');
    });
}


