// Resolve API. Written by Matt Harvey, tweaked by Nicholas Mason.

// 04-Sep-2014 NJM - protect against absence of window.console
if (typeof window.console === "undefined") window.console = {};
if (typeof window.console.log === "undefined") window.console.log = function() {};
if (typeof window.console.error === "undefined") window.console.error = function(error) {alert(error);};
if (typeof window.console.warn === "undefined") window.console.warn = function() {};

// 04-Sep-2014 NJM - converted from synchronous to asynchronous request.
function handle_resolve( handle, callback ) {
    var oReq = new XMLHttpRequest();
    if ("withCredentials" in oReq) {
        //04-Sep-2014 NJM - changed from http://hdl.handle.net/api/ to include query parameter to select for 10320/loc
        oReq.open("GET", "http://hdl.handle.net/api/handles/" + handle + "?type=10320/loc", true);
    } else if (typeof XDomainRequest != "undefined") {
        // IE8 & IE9
        oReq = new XDomainRequest();
        oReq.open("GET", "http://hdl.handle.net/api/handles/" + handle + "?type=10320/loc");
    } else {
        throw new Error("CORS not supported by browser");
    }

    function process_value(value) {
        // 04-Sep-2014 NJM - assignment of data variable changed to account for CNRI updating the structure of their JSON. See http://www.handle.net/overviews/rest-api.html 
        var data;
        if (value.data.format === "string") {
            // Received updated JSON, where data is an object and its value is a string.
            data = value.data.value;
        } else if (typeof value.data.format === "undefined") {
            // data.format is undefined. Assume we have received old-style JSON, where data is a string.
            console.warn("'data.format' is undefined. 'data' assumed to be a string.");
            data = value.data;
        } else {
            // Received updated JSON, but data.value is not a string.
            throw new Error("Expected 'data.value' to be a string, but instead 'data.format' === " + value.data.format);
        }
        
        // 04-Sep-14 NJM - added DOMParser fall back for IE8. 
        var parser;
        var xml;
        if (window.DOMParser) {
            parser = new DOMParser();
            xml = parser.parseFromString( data, "text/xml" );
        } else {
            xml = new ActiveXObject("Microsoft.XMLDOM");
            xml.async=false;
            xml.loadXML(data);
        }
        
        var locs    = xml.getElementsByTagName( "location" );
        var results = new Array();
        var idx = 0;
        
        for (var j = 0, n = locs.length; j<n; j++ ) {
            var href     = locs[j].getAttribute("href");
            var filename = locs[j].getAttribute("filename");
            var mimetype = locs[j].getAttribute("mimetype");
            var result = new Object();
            // 04-Sep-2014 NJM - added warnings and errors for missing attributes
            result.href     = href || console.error( "location "+j+" has no 'href' attribute");
            result.filename = filename || console.warn( "location "+j+" has no 'filename' attribute");
            result.mimetype = mimetype || console.warn( "location "+j+" has no 'mimetype' attribute");
            results[idx++] = result;
        }
        callback(results);
    } 
    
    oReq.onload = function() {
        var obj = JSON.parse( oReq.responseText );
        // 04-Sep-2014 NJM - Added handling for REST API responseCodes
        if (obj.responseCode === 1) {
            // responseCode 1 : Success. (HTTP 200 OK)
            // Loop and test for 10320/loc should be unnecessary due to query parameter. However, have received inconsistant responses from server.
            for(var i = 0; i< obj.values.length; i++ ) {
                if( obj.values[i].type === "10320/loc" ) {
                    process_value(obj.values[i]);
                }
            }
        } else if (obj.responseCode === 200) {
            // responseCode 200 : Values Not Found. The handle exists but has no values (or no values according to the types and indices specified). (HTTP 200 OK)
            console.error("Handle exists but has no value of type 10320/loc. (HTTP 200 OK)");
        } else if (obj.responseCode === 100) {
            // responseCode 100 : Handle Not Found. (HTTP 404 Not Found)
            console.error("Handle Not Found. (HTTP 404 Not Found)");
        } else if (obj.responseCode === 2) {
            // responseCode 2 : Error. Something unexpected went wrong during handle resolution. (HTTP 500 Internal Server Error)
            console.error("Something unexpected went wrong during handle resolution. (HTTP 500 Internal Server Error)");
        }
    };
    
    oReq.onerror = function() {
        console.error("Something unexpected went wrong with the attempted XMLHttpRequest.");
    };
    
    oReq.send(null);
}

function handle_get_parents( res ) {
    return handle_url_by_mimetype( res, "chemical/x-handle-parent" );
}

function handle_get_children( res ) {
    return handle_url_by_mimetype( res, "chemical/x-handle-child" );
}

function handle_url_by_mimetype( res, mimetype ) {
    var ret = new Array();
    var idx=0;
    for (var j =0; j<res.length; j++ ) {
        console.log( j );
        console.log( res[j].mimetype );
        if( res[j].mimetype == mimetype ) {
            ret[idx++] = res[j].href;
        }
    }
    return ret;
}

function handle_url_by_filename( res, filename ) {
    var ret = new Array();
    var idx=0;
    for (var j =0; j<res.length; j++ ) {
        console.log( res[j].filename );
        if( res[j].filename == filename ) {
            ret[idx++] = res[j].href;
        }
    }
    return ret;
}

function handle_load( url ) {
    var oReq = new XMLHttpRequest();
    oReq.open("get", url, false);
    oReq.send();
    if( oReq.status === 200 ) {
        return oReq.responseText;
    }
    return "";
}

function handle_do() {
//document.getElementById("demo").innerHTML="Hello World xxx";
//  return;
    var handle=document.getElementById("handleid").value;
    console.log(handle);

    handle_resolve( handle, function(res) {
        console.log( res );

        var urls= handle_url_by_mimetype( res, "chemical/x-gaussian-log" );

        console.log( urls );

        if( urls.length > 0 ) {
            // document.write( urls[0] );
            Jmol.loadFile( jmolApplet0, urls[0] ) ; //urls[0] );
        }
    });
}

// NJM - function added for loading files to Jmol.
function handle_jmol( handle, jmol_script, applet ) {
    applet = applet || jmolApplet0;
    console.log(handle);
    
    handle_resolve( handle, function(res) {
        // console.log( res );

        var urls = handle_url_by_mimetype( res, "chemical/x-gaussian-log" );
        
        console.log( urls.toString() );

        if( urls.length > 0 )  {
            Jmol.loadFile( applet, urls[0], jmol_script) ;
        }
    });
}