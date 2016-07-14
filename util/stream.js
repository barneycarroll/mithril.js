"use strict"

var guid = 0, noop = function() {}, HALT = {}
function createStream() {
	function stream() {
		if (arguments.length > 0) updateStream(stream, arguments[0], undefined)
		return stream.state.value
	}
	initStream(stream, arguments)

	if (arguments.length > 0) updateStream(stream, arguments[0], undefined)

	return stream
}
function initStream(stream) {
	stream.constructor = createStream
	stream.state = {id: guid++, value: undefined, error: undefined, state: 0, derive: undefined, recover: undefined, deps: {}, parents: [], errorStream: undefined, endStream: undefined}
	stream.map = map, stream.ap = ap, stream.of = createStream
	stream.valueOf = valueOf, stream.toJSON = toJSON
	stream.run = run, stream.catch = doCatch

	Object.defineProperties(stream, {
		error: {get: function() {
			if (!stream.state.errorStream) {
				var errorStream = function() {
					if (arguments.length > 0) updateStream(stream, undefined, arguments[0])
					return stream.state.error
				}
				initStream(errorStream, [])
				initDependency(errorStream, [stream], noop, noop)
				stream.state.errorStream = errorStream
			}
			return stream.state.errorStream
		}},
		end: {get: function() {
			if (!stream.state.endStream) {
				var endStream = createStream()
				endStream.map(function(value) {
					if (value === true) unregisterStream(stream), unregisterStream(endStream)
					return value
				})
				stream.state.endStream = endStream
			}
			return stream.state.endStream
		}}
	})
}
function updateStream(stream, value, error) {
	updateState(stream, value, error)
	for (var id in stream.state.deps) updateDependency(stream.state.deps[id], false)
	finalize(stream)
}
function updateState(stream, value, error) {
	error = unwrapError(value, error)
	if (error !== undefined && typeof stream.state.recover === "function") {
		try {
			var recovered = stream.state.recover()
			if (recovered === HALT) return
			updateValues(stream, recovered, undefined)
		}
		catch (e) {updateValues(stream, undefined, e)}
	}
	else updateValues(stream, value, error)
	stream.state.changed = true
	if (stream.state.state !== 2) stream.state.state = 1
}
function updateValues(stream, value, error) {
	stream.state.value = value
	stream.state.error = error
}
function updateDependency(stream, mustSync) {
	var state = stream.state, parents = state.parents
	if (parents.length > 0 && parents.filter(active).length === parents.length && (mustSync || parents.filter(changed).length > 0)) {
		var failed = parents.filter(errored)
		if (failed.length > 0) updateState(stream, undefined, failed[0].state.error)
		else {
			try {
				var value = state.derive()
				if (value === HALT) return
				updateState(stream, value, undefined)
			}
			catch (e) {
				updateState(stream, undefined, e)
			}
		}
	}
}
function unwrapError(value, error) {
	if (value != null && value.constructor === createStream) {
		if (value.state.error !== undefined) error = value.state.error
		else error = unwrapError(value.state.value, value.state.error)
	}
	return error
}
function finalize(stream) {
	stream.state.changed = false
	for (var id in stream.state.deps) stream.state.deps[id].state.changed = false
}

function run(fn) {
	var self = createStream(), stream = this
	return initDependency(self, [stream], function() {
		return absorb(self, fn(stream()))
	}, undefined)
}
function doCatch(fn) {
	var self = createStream(), stream = this
	var derive = function() {return stream.state.value}
	var recover = function() {return absorb(self, fn(stream.state.error))}
	return initDependency(self, [stream], derive, recover)
}
function combine(fn, streams) {
	return initDependency(createStream(), streams, function() {
		var failed = streams.filter(errored)
		if (failed.length > 0) throw failed[0].state.error
		return fn.apply(this, streams.concat([streams.filter(changed)]))
	}, undefined)
}
function absorb(stream, value) {
	if (value != null && value.constructor === createStream) {
		value.error.map(stream.error)
		value.map(stream)
		if (value.state.state === 0) return HALT
		if (value.state.error) throw value.state.error
		value = value.state.value
	}
	return value
}

function initDependency(dep, streams, derive, recover) {
	var state = dep.state
	state.derive = derive
	state.recover = recover
	state.parents = streams.filter(notEnded)

	registerDependency(dep, state.parents)
	updateDependency(dep, true)

	return dep
}
function registerDependency(stream, parents) {
	for (var i = 0; i < parents.length; i++) {
		parents[i].state.deps[stream.state.id] = stream
		registerDependency(stream, parents[i].state.parents)
	}
}
function unregisterStream(stream) {
	for (var i = 0; i < stream.state.parents.length; i++) {
		var parent = stream.state.parents[i]
		delete parent.state.deps[stream.state.id]
	}
	for (var id in stream.state.deps) {
		var dependent = stream.state.deps[id]
		var index = dependent.state.parents.indexOf(stream)
		if (index > -1) dependent.state.parents.splice(index, 1)
	}
	stream.state.state = 2 //ended
	stream.state.deps = {}
}

function map(fn) {return combine(function(stream) {return fn(stream())}, [this])}
function ap(stream) {return combine(function(s1, s2) {return s1()(s2())}, [this, stream])}
function valueOf() {return this.state.value}
function toJSON() {return JSON.stringify(this.state.value)}

function active(stream) {return stream.state.state === 1}
function changed(stream) {return stream.state.changed}
function notEnded(stream) {return stream.state.state !== 2}
function errored(stream) {return stream.state.error}

function reject(e) {
	var stream = createStream()
	stream.error(e)
	return stream
}

module.exports = {stream: createStream, combine: combine, reject: reject, HALT: HALT}
