// Resolve API - datacite version

// protect against absence of window.console
if (typeof window.console === "undefined") window.console = {};
if (typeof window.console.log === "undefined") window.console.log = function() {};
if (typeof window.console.error === "undefined") window.console.error = function(error) {alert(error);};
if (typeof window.console.warn === "undefined") window.console.warn = function() {};

//
// PRESENTATION FUNCTIONS
//

function format_quality(mimetype) {
    var formats = {
        "chemical/x-gaussian-log" : 3,
        "chemical/x-gaussian-checkpoint" : 1,
        "chemical/x-cml" : 2,
        "chemical/x-pdb" : 2,
        "chemical/x-xyz" : 2,
        "chemical/x-mdl-molfile" : 2
    };
    return formats[mimetype] || 0;
}

function readable_format(mimetype) {
    var formats = [
        "chemical/x-gaussian-log",
        "chemical/x-gaussian-checkpoint",
        "chemical/x-cml",
        "chemical/x-pdb",
        "chemical/x-xyz",
        "chemical/x-mdl-molfile"
    ];
    var number_of_formats = formats.length;
    for(var i=0; i<number_of_formats; i++) {
        if (formats[i] === mimetype) return true;
    }
    return false;
}

function smart_selection(results) {
    var best_href;
    var best_quality = 0;
    for (var i = 0; i<results.length; i++) {
        var quality = format_quality(results[i].mimetype);
        if (quality > best_quality) {
            best_quality = quality;
            best_href = results[i].href;
        }
    }
    return best_href;
}

function present_results(results) {
    var list = document.createElement("ol");
    var list_item;
    for (var i=0; i<results.length; i++) {
        list_item = document.createElement("li");
        list_item.innerHTML = "<table><tr><th>Type:</th><td>"+results[i].mimetype+"</td></tr><tr><th>Filename:</th><td>"+results[i].filename+"</td></tr><tr><th>Location:</th><td>"+results[i].href+"</td></tr></table>";
        list.appendChild(list_item);
    }
    document.getElementById("content").innerHTML = "<p>Files:</p>";
    document.getElementById("content").appendChild(list);
}

function present_results_jmol(results, applet, handle) {
    var list = document.createElement("ol");
    var list_item;
    for (var i=0; i<results.length; i++) {
        list_item = document.createElement("li");
//         if (readable_format(results[i].mimetype)) {
//             list_item.innerHTML = "<a href='javascript:Jmol.loadFile("+applet._id+",&#39;"+results[i].href+"&#39;);'>"+results[i].filename+"</a>";
//         } else {
//             list_item.innerHTML = results[i].filename;
//         }
        list_item.innerHTML = "<a href='javascript:Jmol.loadFile("+applet._id+",&#39;"+results[i].href+"&#39;);'>"+results[i].filename+"</a>";
        list.appendChild(list_item);
    }
    applet._infoHeader = "DOI:"+handle;
    Jmol.setInfo(applet, list, true);
    //console.log(applet);
}

//
// UTILITY FUNCTIONS
//

function nsResolver(prefix) {
    var ns = {
        "datacite" : "http://datacite.org/schema/kernel-3",
        "atom" : "http://www.w3.org/2005/Atom",
        "mets" : "http://www.loc.gov/METS/",
        "xlink" : "http://www.w3.org/TR/xlink/" 
    };
    return ns[prefix] || "*";
}

function getElementsByTagNameNSWithAttribute(xml,ns,element,attribute,value) {
    var matchingElements = [];
    var elements = xml.getElementsByTagNameNS(ns, element);
    for (var i = 0, n = elements.length; i < n; i++) {
        if (elements[i].getAttribute(attribute) === value) {
            // Element exists with attribute. Add to array.
            matchingElements.push(elements[i]);
        }
    }
    return matchingElements;
}

//
// ASYNCHRONOUS HTTP REQUESTS AND XML PROCESSING
//

function handle_request_metadata(handle, selector, callback) {

    // REQUEST HANDLERS
    
    function datacite_metadata_handler() {
        if (this.status === 200) {
            var datacite_metadata = this.responseXML;
            
            var metadata;
            if (metadata = datacite_metadata.querySelector("relatedIdentifier[relatedMetadataScheme='ORE']")) {
                metadata = metadata.textContent;
                console.log("GET: "+metadata);
                request_url = metadata;
                this.onload = ore_metadata_handler;
                this.open("GET", metadata, true);
                this.send(null);
            } else if (metadata = datacite_metadata.querySelector("relatedIdentifier[relatedMetadataScheme='METS']")) {
                metadata = metadata.textContent;
                console.log("GET: "+metadata);
                request_url = metadata;
                this.onload = function() {mets_metadata_handler(metadata.match(/^https?:\/\/[^\/]*/)[0]);};
                this.open("GET", metadata, true);
                this.send(null);
            } else {
                console.error("Could not find ORE or METS metadata.");
            }
        } else if (this.status === 204) {
            console.error("204 - The request was OK but there was no metadata available.");
        } else if (this.status === 404) {
            console.error("404 - The requested DOI either doesn't exist, is not issued by DataCite, or is newly registered (there is a delay of up to around 24hrs before metadata is available)");
        } else if (this.status === 406) {
            console.error("406 - Can't serve any requested content type.");
        } else {
            console.error(this.statusText);
        }
    }
    
    function mets_metadata_handler(root) {
        if (httpRequest.status === 200) {
            if (selector) {
                handle_resolve_s_mets(httpRequest.responseXML, root);
            } else {
                handle_resolve_mets(httpRequest.responseXML, root);
            }
        } else {
            console.error(httpRequest.statusText);
        }
    }
    
    function ore_metadata_handler() {
        if (this.status === 200) {
            if (selector) {
                handle_resolve_s_ore(this.responseXML);
            } else {
                handle_resolve_ore(this.responseXML);
            }
        } else {
            console.error(this.statusText);
        }
    }
        
    // XML PROCESSING 
    
    function handle_resolve_mets(mets, root) {
        var files = mets.getElementsByTagNameNS(nsResolver("mets"), "file");
        var results = [];
        for (var j = 0, n = files.length; j<n; j++ ) {
            var Flocat = files[j].getElementsByTagNameNS(nsResolver("mets"), "FLocat")[0];
            var mimetype = files[j].getAttribute("MIMETYPE");
            var filename = Flocat.getAttributeNS(nsResolver("xlink"), "title");
            var href = Flocat.getAttributeNS(nsResolver("xlink"), "href");
            var result = new Object();
            result.mimetype = mimetype;
            result.filename = filename;
            result.href = root+href;
            console.log(j+".\tname: "+filename+"\n\ttype: "+mimetype+"\n\tURL: "+result.href);
            results.push(result);
        }
        callback(results);
    }

    function handle_resolve_ore(ore) {
        var files = getElementsByTagNameNSWithAttribute(ore, nsResolver("atom"), "link", "rel", "http://www.openarchives.org/ore/terms/aggregates");
        var results = [];
        for (var j = 0, n = files.length; j<n; j++ ) {
            var mimetype = files[j].getAttribute("type");
            var filename = files[j].getAttribute("title");
            var href = files[j].getAttribute("href");
            var result = new Object();
            result.mimetype = mimetype;
            result.filename = filename;
            result.href = href;
            console.log(j+".\tname: "+filename+"\n\ttype: "+mimetype+"\n\tURL: "+href);
            results.push(result);
        }
        callback(results);
    }

    function handle_resolve_s_mets(mets, root) {
        var href;
        var files = mets.getElementsByTagNameNS(nsResolver("mets"), "file");
        for (var i = 0, n = files.length; i<n; i++) {
            var Flocat = files[i].getElementsByTagNameNS(nsResolver("mets"), "FLocat")[0];
            if (files[i].getAttribute("MIMETYPE") === selector || Flocat.getAttributeNS(nsResolver("xlink"), "title") === selector) {
                href = root+Flocat.getAttributeNS(nsResolver("xlink"), "href");
            } 
        }
        callback(href);
    }

    function handle_resolve_s_ore(ore) {
        var href;
        var files = getElementsByTagNameNSWithAttribute(ore, nsResolver("atom"), "link", "rel", "http://www.openarchives.org/ore/terms/aggregates");
        for (var i = 0, n = files.length; i<n; i++) {
            if (files[i].getAttribute("type") === selector || files[i].getAttribute("title") === selector) {
                href = files[i].getAttribute("href");
            } 
        }
        callback(href);
    }
    
    if (XMLHttpRequest) {  
        var httpRequest = new XMLHttpRequest();
        if ("withCredentials" in httpRequest) {
            var request_url = "http://data.datacite.org/" + handle;
            console.log("GET: "+request_url);
            httpRequest.open("GET", request_url, true);
            httpRequest.setRequestHeader("Accept", "application/vnd.datacite.datacite+xml");
            httpRequest.timeout = 10000;
            httpRequest.ontimeout = function() {
                console.error("XMLHttpRequest to '"+request_url+"' has timed out.");
            };
            httpRequest.onload = datacite_metadata_handler;
            httpRequest.onerror = function() {
                console.error("Something unexpected went wrong with the attempted XMLHttpRequest to '"+request_url+"'");
            };
            httpRequest.send(null);
        } else {
            console.error("XMLHttpRequest Level 2 is not supported");
        }
    } else {
        console.error("The XMLHttpRequest object is not supported");
    }
}

//
// API FUNCTIONS
//

function handle_do() {
    var query = document.getElementById("handleid").value;
    query = query.split("?");
    var handle = query[0];
    var selector = query[1] || "chemical/x-gaussian-log";
    var applet = jmolApplet0;
    console.log(handle);
    // request metadata with callback function to send result at jmol.
    handle_request_metadata(handle, selector, function(href) {
        console.log(href);
        // document.getElementById("content").innerHTML = "<p>"+href+"</p>";
        Jmol.loadFile(applet, href);
        Jmol.script(applet, 'set echo TOP LEFT;font echo 12; echo "doi:'+handle+' '+selector+'";');
    });
}

function handle_jmol(query, jmol_script, applet) {
    applet = applet || jmolApplet0;
    query = query.split("?");
    var handle = query[0];
    var selector = query[1] || "chemical/x-gaussian-log";
    console.log(handle);
    // request metadata with callback function to send result at jmol.
    handle_request_metadata(handle, selector, function(href) {
        console.log(href);
        Jmol.loadFile(applet, href, jmol_script);
        Jmol.script(applet, 'set echo TOP LEFT;font echo 12; echo "doi:'+handle+' '+selector+'";');
    });
}

function handle_jmol_demo() {
    var handle = document.getElementById("handleid").value;
    var selector = document.getElementById("handleselector").value;
    var smart = document.getElementById("handlesmart").checked;
    var applet = jmolApplet0;
    console.log(handle);
    if (selector) {
        handle_request_metadata(handle, selector, function(href) {
            //document.getElementById("content").innerHTML = "<p>"+href+"</p>";
            if (href) {
                console.log(href);
                Jmol.loadFile(applet, href);
            } else {
                console.error(selector+" returned no matches.");
            }
        });
    } else if (smart) {
        handle_request_metadata(handle, null, function(results) {
            // console.log(results);
            var href;
            if (href = smart_selection(results)) {
                console.log(href);
                Jmol.loadFile(applet, href);
            } else {
                console.warn("Smart selection returned no suitable matches.");
                present_results_jmol(results, applet, handle);
            }
        });
    } else {
        handle_request_metadata(handle, null, function(results) {
            // console.log(results);
            present_results_jmol(results, applet, handle);
        });
    }
}

