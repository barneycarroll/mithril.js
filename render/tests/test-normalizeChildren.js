"use strict"

var o = require("../../ospec/ospec")
var Vnode = require("../../render/vnode")

o.spec("normalizeChildren", function() {
	o("normalizes arrays into fragments", function() {
		var children = Vnode.normalizeChildren([[]])

		o(children[0].tag).equals("[")
		o(children[0].children.length).equals(0)
	})
	o("normalizes strings into text nodes", function() {
		var children = Vnode.normalizeChildren(["a"])

		o(children[0].tag).equals("#")
		o(children[0].children).equals("a")
	})
	o("treats `false` as a non-entity", function() {
		var children = Vnode.normalizeChildren(["a",false,"b"])

		o(children.length).equals(2)
		o(children[0].children).equals("a")
		o(children[1].children).equals("b")
	})
})
