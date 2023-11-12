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

const CHUNK_SIZE = 1024 * 1024; // 1MB

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


/*******************************************************************************
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

/*******************************************************************************
 * The top of the popup, with the logos and exit button.
 ******************************************************************************/
let popup_head = document.createElement("div");
popup_head.style.width = "100%";
popup_head.style.height = "20px";

let unil_logo = document.createElement("img");
const unil_logo_size = "24px";
unil_logo.classList.add("rounded");
unil_logo.alt = "Unil logo";
unil_logo.style.cssFloat = "left";
unil_logo.src = chrome.runtime.getURL('icons/unil-favicon.ico');
unil_logo.style.height = unil_logo_size;
unil_logo.style.width = unil_logo_size;
unil_logo.style.marginRight = '3px';

let uh_logo = document.createElement("img");
const uh_logo_size = "24px";
uh_logo.classList.add("rounded");
uh_logo.alt = "Unil logo";
uh_logo.style.cssFloat = "left";
uh_logo.src = chrome.runtime.getURL('icons/uh-logo.png');
uh_logo.style.height = uh_logo_size;
uh_logo.style.width = uh_logo_size;
uh_logo.style.marginRight = '3px';

let acv_logo = document.createElement("img");
const acv_logo_size = "32px";
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

popup_head.appendChild(unil_logo)
popup_head.appendChild(uh_logo);
popup_head.appendChild(acv_logo);
popup_head.appendChild(hide_link);

popup.appendChild(popup_head);

/*******************************************************************************
 * The title of the popup.
 ******************************************************************************/
let title = document.createElement("div");
title.className = 'title';
title.innerHTML = chrome.i18n.getMessage("contentPopupTitle");

popup.appendChild(title);

/*******************************************************************************
 * The content of the popup.
 ******************************************************************************/
let content = document.createElement("div");
content.className = 'content';
// The content text is always in the center top of the content.
content.innerHTML = '<p id="details"><p><p id="status">' +
    chrome.i18n.getMessage("contentPopupStatus") +
    '<img src="' + chrome.runtime.getURL("icons/icon16.png") + '" alt="Icon of the plugin"></p>';

popup.appendChild(content);

/*******************************************************************************
 * The file upload button. This button is only visible after the download has
 * completed. After a file is selected, it is made invisble for the calculation
 * step.
 ******************************************************************************/
let buttonWrapper = document.createElement("div");
buttonWrapper.style.display = 'flex';           // Set the buttonWrapper div as a flex container
buttonWrapper.style.flexDirection = 'column';   // Stack children vertically
buttonWrapper.style.alignItems = 'center';      // Center children horizontally
buttonWrapper.style.justifyContent = 'center';  // Center children vertically

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

buttonWrapper.appendChild(uploadButton);

/*******************************************************************************
 * The verification container. This is visible after a file has been selected.
 ******************************************************************************/
let verificationContainer = document.createElement("div");
verificationContainer.style.display = "none";
verificationContainer.style.marginTop = "10px";

let goalHash = document.createElement("div");
goalHash.style.fontFamily = "monospace";
goalHash.style.textAlign = 'center';
goalHash.style.fontSize = '110%';

let calculatedHash = document.createElement("div");
calculatedHash.style.fontFamily = "monospace";
calculatedHash.style.textAlign = 'center';
calculatedHash.style.fontSize = '110%';

// Create the loading bar container
let loadingBarContainer = document.createElement("div");
loadingBarContainer.id = 'loadingBarContainer';
loadingBarContainer.style.width = '100%';
loadingBarContainer.style.backgroundColor = '#ddd';
loadingBarContainer.style.marginTop = "10px";

// Create the loading bar element
let loadingBar = document.createElement("div");
loadingBar.id = 'loadingBar';
loadingBar.style.width = '0%'; // Start at 0%
loadingBar.style.height = '30px'; // Set a fixed height for the loading bar
loadingBar.style.backgroundColor = '#4CAF50';

// Append the loading bar to its container
loadingBarContainer.appendChild(loadingBar);

verificationContainer.appendChild(goalHash);
verificationContainer.appendChild(calculatedHash);
verificationContainer.appendChild(loadingBarContainer);


content.appendChild(fileInput);
content.appendChild(buttonWrapper);
content.appendChild(verificationContainer);


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
    verificationContainer.style.display = 'block';
    goalHash.innerText = checksum.value;
    title.innerHTML = chrome.i18n.getMessage("popupTitle");
    status.innerHTML = chrome.i18n.getMessage("popupDetails") + chrome.i18n.getMessage("popupStatusComputing");
    mask.style.display = 'block';

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
            let workingHash;
            // calculate those checksums according to that algorithm on the given file.
            switch (checksum_type.toLowerCase().replace('-', '').replace(' ', '')) {
                case CHECKSUM_TYPE_MD5:
                    workingHash = CryptoJS.algo.MD5.create();
                    checksum_result = await computeHash(file, workingHash);
                    break;
                case CHECKSUM_TYPE_SHA1:
                    workingHash = CryptoJS.algo.SHA1.create();
                    checksum_result = await computeHash(file, workingHash);
                    break;
                case CHECKSUM_TYPE_SHA256:
                    workingHash = CryptoJS.algo.SHA256.create();
                    checksum_result = await computeHash(file, workingHash);
                    break;
                case CHECKSUM_TYPE_SHA384:
                    workingHash = CryptoJS.algo.SHA384.create();
                    checksum_result = await computeHash(file, workingHash);
                    break;
                case CHECKSUM_TYPE_SHA512:
                    workingHash = CryptoJS.algo.SHA512.create();
                    checksum_result = await computeHash(file, workingHash);
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

        loadingBarContainer.style.display = "none";

        // If they are valid,
        if (valid) {
            // Apply the "safe" styling to the popup.
            title.innerHTML = chrome.i18n.getMessage("contentPopupTitleSafe");
            status.innerHTML = chrome.i18n.getMessage("popupStatusValid");
            goalHash.style.color = 'green';
            calculatedHash.style.color = 'green';
        // Otherwise,
        } else {
            // Apply the "unsafe" styling to the popup.
            title.innerHTML = chrome.i18n.getMessage("contentPopupTitleUnsafe");
            status.innerHTML = chrome.i18n.getMessage("popupStatusInvalid");
            goalHash.style.color = 'red';
            calculatedHash.style.color = 'red';

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
            calculatedHash.innerText = incrementalHash;
            resolve();
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(chunk);
    });
}

async function computeHash(file, workingHash) {
    let chunkStart = 0;
    let chunkEnd;
    while (chunkStart < file.size) {
        chunkEnd = Math.min(chunkStart + CHUNK_SIZE, file.size);
        updateLoadingBar(chunkEnd, file.size);
        const chunk = file.slice(chunkStart, chunkEnd);
        await processChunk(chunk, workingHash);
        chunkStart += CHUNK_SIZE;
    }
    return workingHash.finalize().toString(CryptoJS.enc.Hex);
}

function updateLoadingBar(position, fileSize) {
    let percentage = (position / fileSize) * 100;
    loadingBar.style.width = percentage + '%';
  }
  


