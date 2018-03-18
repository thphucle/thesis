interface Array<T> {
  contains(obj: Object): boolean;
  count(): number;
}

interface String {
  contains(obj: Object): boolean;
  replaceAll(target: string, by: string);
}

String.prototype.contains = function (value): boolean {
  return this.indexOf(value) > -1;
};

String.prototype.replaceAll = function (search, replacement): string {
  return this.replace(new RegExp(search, 'g'), replacement);
};

Array.prototype.count = function (): number {
  return this.length;
};

Array.prototype.contains = function (value): boolean {
  return this.indexOf(value) > -1;
};

