let storage = {};

function set(key, value) {
	storage[key] = value;
}

function get(key) {
	return storage[key];
}

export default {
	set,
	get
};
