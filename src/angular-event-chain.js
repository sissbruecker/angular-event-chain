/**
 * Created with IntelliJ IDEA.
 * User: sasch_000
 * Date: 14.07.13
 * Time: 21:42
 */
angular.module('eventChain', []).factory('$chain', function ($exceptionHandler) {

    var Chain = function (scope) {

        this.scope = scope;
        this.events = [];
        this.position = 0;
        this.waitingListeners = 0;
    };

    Chain.prototype.add = function (event, args) {

        this.events.push({
            event: event,
            args: arguments
        });

        return this;
    };

    Chain.prototype.start = function () {

        this.position = -1;
        this.next();

        return this;
    };

    Chain.prototype.next = function () {

        this.position++;

        if (this.position >= this.events.length) return;

        // Reset listener count
        this.waitingListeners = 0;

        // Broadcast event
        var e = this.events[this.position];

        this.broadcast(e.event, e.args);

        // Continue with next event if there are no listeners waiting
        if (!this.waitingListeners) this.next();
    };

    Chain.prototype.result = function (value) {

        this.waitingListeners--;

        if (!this.waitingListeners) this.next();
    };

    // Copied straight from angular Scope, but checks if listeners return deferred instances
    Chain.prototype.broadcast = function (name, args) {
        var target = this.scope,
            current = target,
            next = target,
            event = {
                name: name,
                targetScope: target,
                preventDefault: function () {
                    event.defaultPrevented = true;
                },
                defaultPrevented: false
            },
            listenerArgs = [event].concat([].slice.call(arguments, 1)),
            listeners, i, length,
            self = this,
            responder = function(value) {
                self.result(value);
            };

        //down while you can, then up and next sibling or up and next sibling until back at root
        do {
            current = next;
            event.currentScope = current;
            listeners = current.$$listeners[name] || [];
            for (i = 0, length = listeners.length; i < length; i++) {
                // if listeners were deregistered, defragment the array
                if (!listeners[i]) {
                    listeners.splice(i, 1);
                    i--;
                    length--;
                    continue;
                }

                try {

                    var result = listeners[i].apply(null, listenerArgs);

                    // We assume that if the result has a then() method then we have a promise
                    if (result && result.then) {

                        this.waitingListeners++;

                        result.then(responder, responder);
                    }

                } catch (e) {
                    $exceptionHandler(e);
                }
            }

            // Insanity Warning: scope depth-first traversal
            // yes, this code is a bit crazy, but it works and we have tests to prove it!
            // this piece should be kept in sync with the traversal in $digest
            if (!(next = (current.$$childHead || (current !== target && current.$$nextSibling)))) {
                while (current !== target && !(next = current.$$nextSibling)) {
                    current = current.$parent;
                }
            }
        } while ((current = next));

        return event;
    };

    return function (scope) {
        return new Chain(scope);
    };
});
