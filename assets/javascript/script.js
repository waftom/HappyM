// Firebase key
var config = {
    apiKey: "AIzaSyArprwD6qM4Z6qf8LkXaO-qBTwCwiVJSz8",
    authDomain: "happy-medium-152501.firebaseapp.com",
    databaseURL: "https://happy-medium-152501.firebaseio.com",
    storageBucket: "happy-medium-152501.appspot.com",
    messagingSenderId: "37679856259"
};
firebase.initializeApp(config);             // Initialization
var database = firebase.database();

$('.g-signin2').trigger();                  // Google Sign In button trigger
var profile = '';                           // Gets the user info from Google
var name = null;                            // User name from Google
var email = null;                           // User email from Google
var room = false;                           // Flag to know if room created
var room_timestamp;                         // Reference for the current room
var room_reference;                         // Reference for the current room
var count = 1;                              // User number reference on Firebase
var xloc = null;                            // Medium Marker, used to remove and add a new one
var mapArray = new Array;                   // Array with all users lat and long info
var pos;                                    // Gets the user lat and long
var newMap;                                 // The actual map
var mapOptions;                             // Options to add to the map
var service;                                // Used for Google Directions
var bounds;                                 // Used for Google Directions
var bounds_markes = new Array;              // Array with all markers of the places, used to remove and add a new ones
var user_ref;                               // Reference of the user number from firebase
var avgLat = 0;                             // Avarage lat
var avgLng = 0;                             // Avarage long
var directionsService;                      // Used for Google Directions
var directionsDisplay;                      // Used for Google Directions
var interval = 0;                           // Used to keep updating marker for the first 10 seconds

// Google Sign In
function onSignIn(googleUser) {
    profile = googleUser.getBasicProfile();
    name = profile.getName();
    email = profile.getEmail();

    $('.g-signin2').hide();                 // hide Google button after Logged
    $('#hello').html("Hello <strong>" + name + "</strong>, start or join a room to begin."); // Add welcome user name after Logged
    room = true;

    // After Sign In enable the menu
    $('#create_room').removeClass("disabled");
    $('#join_room').removeClass("disabled");
    $('#sign_out').removeClass("disabled");

    filljoinroom();
}

// Fill the rooms created on menu after Logged
function filljoinroom() {
    var rooms = 0;
    // Search Firebase for new rooms
    database.ref().on("child_added", function(snapshot) {
        // If created, add to the menu
        if(typeof snapshot.val().created_by === 'string' && snapshot.val() !== null) {
            if(rooms <= 0) $('#ul_join_room').html('');
            // Append all the list of rooms
            $('#ul_join_room').append('<li><a onclick="initiate_join(\'' + snapshot.val().created_by + '\',\'' + snapshot.val().date + '\',\'' + snapshot.val().reference + '\')">' + snapshot.val().created_by + ' (' + snapshot.val().date + ')</a></li>');
            rooms++;
        }
    });
}

// Google Sign Out
function signOut() {
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () { // Logs the user out
        console.log('User signed out.');
    });
    window.location = "index.html"; // Refresh the page
}

$(document).ready(function() {
    // Listen for create room button clicked
    $('#create_room').click(function() {
        if(room) {
            $('#content').show(); // Show the map and all info
            initiate(); // Initiate a room
            room = false;
        }
    });

    // Listen for the Chat input
    $('#happy_msg').keypress(function(event) {
        var keycode = (event.keyCode ? event.keyCode : event.which);
        // If Enter key pressed and content not empty
        if(keycode == '13' && $('#happy_msg').val() != ''){
            // Add msg to Firebase
            database.ref("/room_" + room_reference + "/chat").push({
                id: email,
                time: moment().get('hour') + ':' + moment().get('minute') + ':' + moment().get('second'),
                msg: $('#happy_msg').val()
            });
            $('#happy_msg').val(''); // Clear the input
        }
    });

    $('#ul_join_room').click(function() {
        var n = $('#ul_join_room').height();
        $('#ul_join_room').animate({ scrollTop: n }, 50);
    })
});

// Add a marker to the map
function addMarker(lat,lng,id,index) {
    var drag = false;
    if(id === email) { // Check if current marker is from the user
        drag = true; // If true, turn it draggable
    }
    markerOptions = {
        position: new google.maps.LatLng(lat,lng),
        draggable: drag,
        label: count+''
    };

    marker = new google.maps.Marker(markerOptions);
    mapArray[count-1] = new Array(count, lat, lng, marker); // Add marker info to the array

    $('#list_users').append('<li><strong>' + count + '</strong>: ' + id + '</li>'); // Add user to the User List

    count++;
    marker.setMap(newMap); // Add marker to the map

    // If marker is from user, add listener to draggable
    if(id === email) {
        google.maps.event.addListener(marker, 'dragend', function (event) {
            userChangePosition(this.label,this.getPosition().lat(),this.getPosition().lng(),this);
        });
    }

    getMedium();
}

// Change lat and long of the user
function userChangePosition(c, la, lo, marker) {
    mapArray[parseInt(c)-1] = new Array(parseInt(c), la, lo, marker); // Update array

    // Update Firebase
    database.ref("/room_" + room_reference + "/users").on("child_added", function(snapshot) {
        // Update only the user
        if(email === snapshot.val().id) {
            snapshot.ref.update({
                lat: la,
                lng: lo
            });
        }
    });

    getMedium();
}

// Creates the medium marker
function getMedium() {
    // Remove marker to add a new one
    if(xloc !== null) {
        xloc.setMap(null);
    }

    avgLat = 0;
    avgLng = 0;
    var j = 0;

    // Get the Avarage location
    for(var i=0;i<mapArray.length;i++) {
        avgLat = (avgLat + mapArray[i][1]);
        avgLng = (avgLng + mapArray[i][2]);
        j++;
    }

    avgLat = avgLat / j; // Get the lat
    avgLng = avgLng / j; // Get the long

    var markerOptions2 = {
        position: new google.maps.LatLng(avgLat,avgLng),
    };
    var marker2 = new google.maps.Marker(markerOptions2); // Create marker

    marker2.setMap(newMap); // Add the new marker to map

    xloc = marker2; // Store current marker

    // Get the nearest places to meet based on medium marker
    if(count > 2) {
        service = new google.maps.places.PlacesService(newMap);
        service.nearbySearch({
            location: new google.maps.LatLng(avgLat,avgLng),
            radius: 500, // 500 meters of radius
            types: ['cafe','restaurant']
        }, processResults);
    }
}

// Check the places on google
function processResults(results, status) {
    if(status == google.maps.places.PlacesServiceStatus.OK) {
        createMarkers(results);
    }
}

// Create the marker places
function createMarkers(places) {
    // Remove old markers
    for (var i = 0; i < bounds_markes.length; i++) {
        bounds_markes[i].setMap(null);
    }

    $('#meeting_places').html(''); // Empty the sidebar places
    bounds = new google.maps.LatLngBounds();

    var c = 0;
    for (var i = 0, place; place = places[i]; i++) {
        // Chack if place is ok
        if(typeof place.geometry.viewport.f.b != 'undefined' && typeof place.geometry.viewport.b.b != 'undefined') {
            if(c >= 6) break; // Stop with max of 6 places
            var image = {
                url: place.icon,
                size: new google.maps.Size(71, 71),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(17, 34),
                scaledSize: new google.maps.Size(25, 25)
            };

            // Create the place marker
            var marker = new google.maps.Marker({
                map: newMap,
                icon: image,
                title: place.name,
                position: place.geometry.location
            });

            bounds_markes.push(marker); // Add the marker to array

            // Add the place to sidebar
            $('#meeting_places').append('<li><a class="places" title="' + place.vicinity + '" onclick="calcRoute(' + place.geometry.viewport.f.b + ',' + place.geometry.viewport.b.b + ')">' + place.name + '</a></li>');

            bounds.extend(place.geometry.location);
            c++;
        }
    }
    //newMap.fitBounds(bounds);
}

// Update marker
function updateMarkers() {
    // Remove all user markers
    for(var i=0;i<mapArray.length;i++) {
        mapArray[i][3].setMap(null);
    }

    mapArray = []; // Empty array
    $('#list_users').html(''); // Empty sidebar
    count = 1;
    // Check firebase for new users and add marker
    database.ref("/room_" + room_reference + "/users").on("child_added", function(snapshot) {
        addMarker(snapshot.val().lat,snapshot.val().lng,snapshot.val().id,false);
    });
}

// Shows the Direction from user to the desired place
function calcRoute(la,lo) {
    directionsService = new google.maps.DirectionsService();
    directionsDisplay = new google.maps.DirectionsRenderer();
    directionsDisplay.setMap(null);
    directionsDisplay.setDirections(null);

    // Request direction from user to the place
    var request = {
        origin: new google.maps.LatLng(mapArray[user_ref-1][1], mapArray[user_ref-1][2]),
        destination: new google.maps.LatLng(la, lo),
        travelMode: google.maps.TravelMode.DRIVING
    };

    // Get the info
    directionsService.route(request, function(response, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            directionsDisplay.setDirections(response);
        }
    });

    directionsDisplay.setMap(newMap); // Add the direction to the map
}

// Listeners for new users, change positions and Chat
function threads() {
    var same_user = '';

    // Chat listener
    database.ref("/room_" + room_reference + "/chat").on("child_added", function(snapshot) {
        var color_class;

        // Check same user
        if(same_user === snapshot.val().id) {
            $('#happy_chat').append('<div class="msg_same"><span class="msg_msg"><a title="' + snapshot.val().time + '">' + snapshot.val().msg + '</a></span></div>');
        } else {
            // If same user change color
            if(snapshot.val().id == email) color_class = "msg_id_owner";
            else color_class = "msg_id";
            $('#happy_chat').append('<div class="msg"><span class="' + color_class + '">' + snapshot.val().id + '</span><br><span class="msg_msg"><a title="' + snapshot.val().time + '">' + snapshot.val().msg + '</a></span></div>');
        }

        same_user = snapshot.val().id;
        var n = $('#happy_chat').height();
        $('#happy_chat').animate({ scrollTop: n }, 50); // Scrol the bar to the bottom
    });

    // User listener
    database.ref("/room_" + room_reference + "/users").on("child_added", function(snapshot) {
        addMarker(snapshot.val().lat,snapshot.val().lng,snapshot.val().id,false);
    });

    // Position change listener
    database.ref("/room_" + room_reference + "/users").on("value", function(snapshot) {
        if(snapshot.val() !== null) {
            //console.log(snapshot.val().refer + " - " + snapshot.val().lat + " - " + snapshot.val().lng + " - " + snapshot.val().id);
            updateMarkers();
        }
    });
}

// Initiate a room
function initiate() {
    // Disable the menu
    $('#create_room').addClass("disabled");
    $('#join_room').addClass("disabled");

    // Create the timestamp that will used for room reference
    room_timestamp = Date.now();
    room_reference = room_timestamp;

    $(document).ready(function() {
        threads();

        // Map initialization
        function myMap() {
            var infoWindowOptions = {
                // content: 'BC Testing!'
            };
            var infoWindow = new google.maps.InfoWindow(infoWindowOptions);

            // Get user location
            navigator.geolocation.getCurrentPosition(function(position) {
                pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                infoWindow.setPosition(pos);
                infoWindow.setContent('You are here.');
                user_ref = 1;

                // Add room info to firebase
                database.ref("/room_" + room_timestamp).set({
                    created_by: name,
                    date: moment().get('month')+1 + '/' + moment().get('date') + '/' + moment().get('year') + ' ' + moment().get('hour') + ':' + moment().get('minute') + ':' + moment().get('second'),
                    reference: room_timestamp,
                    chat: {},
                    users: {
                        user_1: {
                            refer: 1,
                            id: email,
                            lat: pos.lat,
                            lng: pos.lng
                        }
                    }
                });

                // User location and first marker
                mapOptions = {
                    center: new google.maps.LatLng(pos.lat, pos.lng),
                    zoom: 12,
                    mapTypeId: google.maps.MapTypeId.ROADMAP
                };

                newMap = new google.maps.Map(document.getElementById('mapArea'), mapOptions); // Add user location and create the map
            });
        } // end of myMap function

        myMap();

        // Update markers for the first 10 seconds
        setInterval(function(){
            if(interval < 5) {
                updateMarkers();
                interval++;
            }
        }, 2000);
    }); // end of document ready
}

// Join a room
function initiate_join(name,date,reference) {
    // Disable the menu
    $('#create_room').addClass("disabled");
    $('#join_room').addClass("disabled");

    $('#content').show(); // Show map
    room_reference = reference; // Get the timestamp that will used for room reference

    threads();

    var count_users = 1;
    database.ref("/room_" + reference + '/users').on("child_added", function(snapshot) {
        count_users++;
    });

    $(document).ready(function() {

        // Map initialization
        function myMap1() {
            var infoWindowOptions = {
                // content: 'BC Testing!'
            };
            var infoWindow = new google.maps.InfoWindow(infoWindowOptions);

            // Get user location
            navigator.geolocation.getCurrentPosition(function(position) {
                pos = {
                    lat: position.coords.latitude + (count_users / 100),
                    lng: position.coords.longitude + (count_users / 100)
                };
                infoWindow.setPosition(pos);
                infoWindow.setContent('You are here.');
                user_ref = count_users;

                // Add user info to firebase
                database.ref("/room_" + reference + "/users/user_"+count_users).set({
                    refer: count_users,
                    id: email,
                    lat: pos.lat,
                    lng: pos.lng
                });

                // User location and first marker
                mapOptions = {
                    center: new google.maps.LatLng(pos.lat, pos.lng),
                    zoom: 12,
                    mapTypeId: google.maps.MapTypeId.ROADMAP
                };

                newMap = new google.maps.Map(document.getElementById('mapArea'), mapOptions); // Add user location and create the map
            });
        } // end of myMap function

        myMap1();

        // Update markers for the first 10 seconds
        setInterval(function(){
            if(interval < 5) {
                updateMarkers();
                interval++;
            }
        }, 2000);
    }); // end of document ready
}
