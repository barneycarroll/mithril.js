"use strict"

var o = require("../../ospec/ospec")
var trust = require("../../render/trust")

o.spec("trust", function() {
	o("works with html", function() {
		var vnode = trust("<a></a>")

		o(vnode.tag).equals("<")
		o(vnode.children).equals("<a></a>")
	})
	o("works with text", function() {
		var vnode = trust("abc")

		o(vnode.tag).equals("<")
		o(vnode.children).equals("abc")
	})
	o("casts false to empty string", function() {
		var vnode = trust(false)

		o(vnode.tag).equals("<")
		o(vnode.children).equals(false)
	})
})
