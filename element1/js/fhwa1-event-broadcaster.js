function initEventBroadcaster() {
    var broadcaster = {},
        eventHandlers = {};

    // Initialize available events
    Object.keys(FHWA.Event).forEach(function (eventName) {
        eventHandlers[FHWA.Event[eventName]] = [];
    });

    /* Add a handler to the list for the given event */
    broadcaster.subscribe = function (eventName, handler) {
        if (!eventHandlers.hasOwnProperty(eventName)) {
            throw new Error('Unrecognized event: ' + eventName);
        }

        eventHandlers[eventName].push(handler);
    };

    /* Remove a handler from the list for the given event */
    broadcaster.unsubscribe = function (eventName, handler) {
        if (!eventHandlers.hasOwnProperty(eventName)) {
            throw new Error('Unrecognized event: ' + eventName);
        }

        var subscribers = eventHandlers[eventName];
        for (var i = 0; i < subscribers.length; i++) {
            if (subscribers[i] === handler) {
                subscribers.splice(i, 1);
                return true;
            }
        }

        return false;
    };

    /* Alert all subscribers that the given event has happened;
     * call their handlers with the given data */
    broadcaster.publish = function (eventName, data) {
        if (!eventHandlers.hasOwnProperty(eventName)) {
            throw new Error('Unrecognized event: ' + eventName);
        }

        var subscribers = eventHandlers[eventName];
        for (var i = 0; i < subscribers.length; i++) {
            subscribers[i](data);
        };
    };

    return broadcaster;
};

var FHWA = FHWA || {};
FHWA.Event = FHWA.Event || {};

// Data: none
FHWA.Event.HUDEnter = 'fhwa-hud-enter';
FHWA.Event.HUDLeave = 'fhwa-hud-leave';

// Data: link object
FHWA.Event.LinkMouseOver = 'fhwa-link-mouse-over';
FHWA.Event.LinkMouseOut = 'fhwa-link-mouse-out';
FHWA.Event.LinkDeselect = 'fhwa-link-deselect';
FHWA.Event.LinkSelect = 'fhwa-link-select';

// Data: link direction ('A'/'B')
FHWA.Event.LinkDirectionHighlight = 'fhwa-link-direction-highlight';
FHWA.Event.LinkDirectionUnhighlight = 'fhwa-link-direction-unhighlight';

// Data: alpha/beta
FHWA.Event.CameraAngleUpdate = 'fhwa-camera-angle-update';

// Data: current time (moment)
FHWA.Event.TimeUpdate = 'fhwa-time-update';

// Init the broadcaster AFTER all the events have been declared
FHWA.Broadcaster = initEventBroadcaster();
