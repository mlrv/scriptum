/*
                                88                                                    
                                ""              ,d                                    
                                                88                                    
,adPPYba,  ,adPPYba, 8b,dPPYba, 88 8b,dPPYba, MM88MMM 88       88 88,dPYba,,adPYba,   
I8[    "" a8"     "" 88P'   "Y8 88 88P'    "8a  88    88       88 88P'   "88"    "8a  
 `"Y8ba,  8b         88         88 88       d8  88    88       88 88      88      88  
aa    ]8I "8a,   ,aa 88         88 88b,   ,a8"  88,   "8a,   ,a88 88      88      88  
`"YbbdP"'  `"Ybbd8"' 88         88 88`YbbdP"'   "Y888  `"YbbdP'Y8 88      88      88  
                                   88                                                 
                                   88                                                 
*/


/******************************************************************************
*******************************************************************************
**********************************[ GLOBAL ]***********************************
*******************************************************************************
******************************************************************************/


/***[ Constants ]*************************************************************/


const PREFIX = "$_"; // avoids property name clashes

// validator related

const CHECK = true; // type validator flag

export const ADT = PREFIX + "adt";
export const ANNO = PREFIX + "anno";

const MAX_COLONS = 80; // limit length of error messages
const MAX_TUPLE = 4;

// treshold of deferring computation to next micro task

const MICROTASK_TRESHOLD = 0.01;

const SAFE_SPACE = "·"; // use within type indentations

// lib related

// JS related

const TAG = Symbol.toStringTag;

const LT = -1;
const EQ = 0;
const GT = 1;

const NOT_FOUND = -1;

const letterA = 97;

/***[ Type Dictionaries ]*****************************************************/


const adtDict = new Map(), // ADT dict Map(tcons => {arity, kind})
  tcDict = new Map(); // type class dict Map(tcons => {arity, kind})


const nativeDict = new Map([ // native type dict Map(tcons => {arity, kind})
  ["Map", {arity: 2, kind: "* => * => *"}],
  ["Set", {arity: 1, kind: "* => *"}],
  ["Vector", {arity: 1, kind: "* => *"}]]);


const nativeIntrospection = new Map([
  ["Map", (m, state, introspectDeep_) => {
    const ts = new Map();

    for (let [k, v] of m)
      ts.set(introspectDeep_(k), introspectDeep_(v));

    if (ts.size === 0)
      return `Map<${String.fromCharCode(state.charCode++)}, ${String.fromCharCode(state.charCode++)}>`;

    else if (ts.size > 1) {
      const tk = [],
        tv = [];

      ts.forEach((v, k) => {
        if (k.search(new RegExp("[a-z][a-zA-Z0-9]*", "")) === NOT_FOUND)
          tk.push(k);

        if (v.search(new RegExp("[a-z][a-zA-Z0-9]*", "")) === NOT_FOUND)
          tv.push(v);
      })

      if (tk.length > 1)
        throw new TypeError(cat(
          "invalid Map\n",
          "must contain homogeneous keys and values\n",
          "but the following keys received:",
          `${tk.join(", ")}\n`));

      else if (tv.length > 1)
        throw new TypeError(cat(
          "invalid Map\n",
          "must contain homogeneous keys and values\n",
          "but the following values received:",
          `${tv.join(", ")}\n`));

      else return `Map<${tk[0]}, ${tv[0]}>`;
    }

    else return `Map<${Array.from(ts) [0].join(", ")}>`;
  }],

  ["Set", (s, state, introspectDeep_) => {
    const ts = new Set();

    for (let v of s)
      ts.add(introspectDeep_(v));

    if (ts.size === 0)
      return `Set<${String.fromCharCode(state.charCode++)}>`;

    else if (ts.size > 1) {
      const ts_ = []

      ts.forEach(t => {
        if (t.search(new RegExp("[a-z][a-zA-Z0-9]*", "")) === NOT_FOUND)
          ts_.push(t);
      })

      if (ts_.length > 1)
        throw new TypeError(cat(
          "invalid Set\n",
          "must contain homogeneous keys\n",
          "but the following values received:",
          `${ts_.join(", ")}\n`));

      else return `Set<${ts_[0]}>`;
    }

    else return `Set<${Array.from(ts) [0]}>`;
  }],

  ["Vector", (o, state, introspectDeep_) => {
    if (o.length === 0)
      return "Vector<a>";

    else
      return `Vector<${introspectDeep_(o.data.v)}>`;
  }]]);


const monoDict = new Set([ // Tconst register
  "Char",
  "Integer",
  "Natural"]);


/***[ Combinators ]***********************************************************/


const cat = (...lines) => lines.join("");


const extendErrMsg = (lamIndex, argIndex, funAnno, argAnnos, instantiations) => {
  if (lamIndex === null)
    lamIndex = "";

  else
    lamIndex = `in lambda #${lamIndex + 1}\n`;

  if (argIndex === null)
    argIndex = "";

  else
    argIndex = `in argument #${argIndex + 1}\n`;

  if (argAnnos === null)
      argAnnos = "";

  else if (argAnnos.length === 0)
    argAnnos = "original arg: ()\n";

  else
    argAnnos = `original arg: ${argAnnos.join(", ")}\n`;

  if (instantiations.size > 0) {
    const instantiations_ = [];

    instantiations.forEach((v, k) => {
      v.forEach((v_) => {
        instantiations_.push([k, serializeAst(v_.value)]);
      });
    });

    instantiations = "\n" + instantiations_.map(
      ([k, v]) => `${k} ~ ${v}`).join("\n");
  }

  else instantiations = "";

  return cat(
    lamIndex,
    argIndex,
    `original fun: ${funAnno}\n`,
    argAnnos,
    instantiations + "\n");
};


const setNestedMap = (k, k_, v) => m => {
  if (!m.has(k))
    m.set(k, new Map());

  if (!m.get(k).has(k_))
    m.get(k).set(k_, v);

  return m;
};


/******************************************************************************
*******************************************************************************
*********************************[ SUBTYPES ]**********************************
*******************************************************************************
******************************************************************************/


/***[ Argument Types ]********************************************************/


// nullary functions (no arguments)

class Arg0 extends Array {
  constructor() {super(0)}

  get [Symbol.toStringTag] () {
    return "Arg0";
  }
}


// unary functions

class Arg1 extends Array {
  constructor(x) {
    super(1);
    this[0] = x;
  }

  get [Symbol.toStringTag] () {
    return "Arg1";
  }
}


// variadic functions (dynamic argument length)

class Argv extends Array {
  constructor(x) {
    super(1);
    this[0] = x;
  }

  get [Symbol.toStringTag] () {
    return "Argv";
  }
}


// n-ary functions (multi-agrument)

class Args extends Array {
  constructor(n) {
    super(n);
  }

  get [Symbol.toStringTag] () {
    return "Args";
  }

  static fromArr(xs) {
    const ys = new Args(xs.length).fill(null);
    xs.forEach((x, i) => ys[i] = x);
    return ys;
  }
}


// n-ary functions (multi-agrument) with a variadic one as last argument

class Argsv extends Array {
  constructor(n) {
    super(n);
  }

  get [Symbol.toStringTag] () {
    return "Argsv";
  }

  static fromArr(xs) {
    const ys = new Argsv(xs.length).fill(null);
    xs.forEach((x, i) => ys[i] = x);
    return ys;
  }
}


/***[ Char ]******************************************************************/


export const Char = s => {
  if (CHECK) {
    if (typeof s !== "string" || s.size !== 1)
      throw new TypeError(cat(
        "type mismatch\n",
        "expected: a single character String\n",
        `received: ${introspectDeep({charCode: letterA}) (s)}\n`,
        "while constructing a Char\n"));
  }

  return {
    [TAG]: "Char",
    value: s,
    valueOf: () => s,
    toString: () => s
  }
};


/***[ Natural ]***************************************************************/


export const Nat = n => {
  if (CHECK) {
    if (typeof n !== "number" || n % 1 !== 0 || n < 0)
      throw new TypeError(cat(
        "type mismatch\n",
        "expected: a positive integer-like Number\n",
        `received: ${introspectDeep({charCode: letterA}) (n)}\n`,
        "while constructing a Natural\n"));
  }

  return {
    [TAG]: "Natural",
    value: n,
    valueOf: () => n,
    toString: () => String(n)
  };
};


/***[ Integer ]***************************************************************/


export const Int = n => {
  if (CHECK) {
    if (typeof n !== "number" || n % 1 !== 0)
      throw new TypeError(cat(
        "type mismatch\n",
        "expected: an integer-like Number\n",
        `received: ${introspectDeep({charCode: letterA}) (n)}\n`,
        "while constructing an Integer\n"));
  }

  return {
    [TAG]: "Integer",
    value: n,
    valueOf: () => n,
    toString: () => String(n)
  }
};


/***[ Non-Empty Array ]*******************************************************/


/* The constructor allows creating empty non-empty arrays, because otherwise we
could not use the built-in Array methods. */

export class NEArray extends Array {
  constructor(n) {
    super(n);
  }

  get [Symbol.toStringTag] () {
    return "NEArray";
  }

  static fromArr(xs) {
    const ys = new NEArray(xs.length);
    xs.forEach((x, i) => ys[i] = x);
    return ys;
  }

  static fromRest(...xs) {
    const ys = new NEArray(xs.length);
    xs.forEach((x, i) => ys[i] = x);
    return ys;
  }
}


/***[ Tuple ]*****************************************************************/


/* There is a superordinate tuple constructor for all tuple types only limited
by the lower and upper bound. Each tuple type carries a size property to
determine the specific tuple type. Tuple values are subtypes of arrays but are
sealed. */

export class Tuple extends Array {
  constructor(...args) {
    if (args.length < 2)
      throw new TypeError(cat(
        "invalid Tuple\n",
        "must contain at least 2 fields\n",
        JSON.stringify(args).slice(0, MAX_COLONS),
        "\n"));

    else if (args.length > MAX_TUPLE)
      throw new TypeError(cat(
        "invalid Tuple\n",
        `must contain at most ${MAX_TUPLE} fields\n`,
        JSON.stringify(args).slice(0, MAX_COLONS),
        "\n"));

    else {
      super(args.length);

      args.forEach((arg, i) => {
        this[i] = arg;
      });

      Object.seal(this);
    }
  }

  get [Symbol.toStringTag] () {
    return "Tuple";
  }
}


/******************************************************************************
*******************************************************************************
************************************[ AST ]************************************
*******************************************************************************
******************************************************************************/


// algebraic data types

const Adt = (cons, body) =>
  ({[Symbol.toStringTag]: Adt.name, cons, body});


const Arr = body =>
  ({[Symbol.toStringTag]: Arr.name, body});


/* During substitution it matters in which position a function argument is
supposed to be substituted. If it is in a codomain position, i.e. in the result
type of a function, the function argument is substituted without additional
parenthesis, whereas in domain position parenthesis are required. `Codomain` is
a constructor that internally denotes a substitution in codomain position. */

const Codomain = (...body) =>
  ({[Symbol.toStringTag]: Codomain.name, body});


/* `Forall` is lexically characterized by round parenthesis. Its usage is
ambiguous. On the one hand it denotes top-level or nested quantifiers and on
the other hand it groups function subterms of a given annotation. In the
latter case the quantifiers has no bound type variables. */

const Forall = (btvs, scope, body) =>
  ({[Symbol.toStringTag]: Forall.name, btvs, scope, body});


const Fun = (lambdas, result) =>
  ({[Symbol.toStringTag]: Fun.name, body: {lambdas, result}});


// Javascript's native exotic object types (e.g. Map, Set)

const Native = (cons, body) =>
  ({[Symbol.toStringTag]: Native.name, cons, body});


// non-empty array

const Nea = body =>
  ({[Symbol.toStringTag]: Nea.name, body});


// Objects implicitly create a self reference to enable method chaining.

const Obj = (cons, props, row, body) => {
  const o = {[Symbol.toStringTag]: Obj.name, cons, props, row, body};
  o.this = o;
  return o;
}


/* `Partial` is used to denote not consumed type parameters of a
partially applied type constructor. */

const Partial = ({[Symbol.toStringTag]: "Partial"});


// `RowType` and `RowVar` encode row polymorphism 

const RowType = body =>
  ({[Symbol.toStringTag]: RowType.name, body});


const RowVar = name =>
  ({[Symbol.toStringTag]: RowVar.name, name});


// `Obj` self refecrence to allow method chaining

const This = (nesting, o) => {
  o[TAG] = This.name;
  o.nesting = nesting;
  return o;
};


// tuples

const Tup = (size, body) =>
  ({[Symbol.toStringTag]: Tup.name, size, body});


// type constant

const Tconst = name =>
  ({[Symbol.toStringTag]: Tconst.name, name});


/***[ Type Variables ]********************************************************/


const BoundTV = (name, scope, position, body) =>
  ({[Symbol.toStringTag]: BoundTV.name, name, scope, position, body});


const MetaTV = (name, scope, position, body) => // a.k.a. flexible type variable
  ({[Symbol.toStringTag]: MetaTV.name, name, scope, position, body});


const RigidTV = (name, scope, position, body) => // a.k.a. skolem constant
  ({[Symbol.toStringTag]: RigidTV.name, name, scope, position, body});


/******************************************************************************
********************************[ COMBINATORS ]********************************
******************************************************************************/


// determine the arity of the passed type constructor

const retrieveArity = ast => {
  switch (ast[TAG]) {
    case "Fun": {
      switch (ast.body.lambdas[0] [TAG]) {
        case "Arg0": return 1;
        case "Arg1": return 2;
        case "Args": return ast.body.lambdas[0].length + 1;
        default: return 0; // Argv/Argsv are excluded
      }
    }

    default: {
      if ("body" in ast) {
        if ("length" in ast.body)
          return ast.body.length;

        else
          return 1;
      }

      else
        return 0;
    }
  }
};


// determine the kind of a known type constructor

const retrieveKind = ast => {
  switch (ast[TAG]) {
    case "Adt": return adtDict.has(ast.cons)
      ? adtDict.get(ast.cons).kind
      : tcDict.get(ast.cons).kind;

    case "Arr": return "* => *";

    case "Fun":
      return "* => "
        .repeat(retrieveArity(ast))
        .concat("*");

    case "Native": return nativeDict.get(ast.cons).kind;
    case "Nea": return "* => *";
    case "Obj": return "*" + " => *".repeat(ast.size);
    case "Tconst": return "*";
    case "Tup": return "*" + " => *".repeat(ast.size);

    case "BoundTV":
    case "MetaTV":
    case "RigidTV": throw TypeError(
      "internal error: unexpected type variable @retrieveKind");

    case "Tcons": throw TypeError(
      "internal error: unexpected polymorphic type constructor @retrieveKind");

    default: throw TypeError(
      "internal error: unknown type constructor @retrieveKind");
  }
};


const getRank = scope =>
  scope.split(/\./).length - 1;


// infer the kind of an unknown type constructor

const inferKind = tconsAst => {
  return tconsAst.body.reduce((acc, ast) => {
    if (isTV(ast)) {
      const higherKind = ast.body.reduce((acc_, ast_) => {
        if (ast_[TAG] === "Partial")
          return `${acc_}* => `;

        else return acc_;
      }, "");

      if (higherKind === "") return `${acc}* => `;
      else return `${acc}(${higherKind}*) => `;
    }

    else return acc;
  }, "").concat("*");
}


/* Determine whether the first scope is a parent or the same as the second one. */

const isParentScope = (parentScope, childScope) =>
  childScope.split(/\./).length >= parentScope.split(/\./).length
    && childScope.search(parentScope) === 0;


const isTV = ast => {
  switch (ast[TAG]) {
    case "BoundTV":
    case "MetaTV":
    case "RigidTV": return true;
    default: return false;
  }
};


const mapAst = f => {
  const go = ast => {
    switch (ast[TAG]) {
      case "Adt": return f(
        Adt(
          ast.cons,
          ast.body.map(go)));

      case "Arg0": return new Arg0();
      case "Arg1": return new Arg1(go(ast[0]));
      case "Args": return Args.fromArr(ast.map(go));
      case "Argsv": return Argsv.fromArr(ast.map(go));
      case "Argv": return new Argv(go(ast[0]));
      case "Arr": return f(Arr(go(ast.body)));

      case "BoundTV":
        return f(
          BoundTV(
            ast.name,
            ast.scope,
            ast.position,
            ast.body.map(go)));

      case "Forall":
        return f(
          Forall(
            ast.btvs,
            ast.scope,        
            go(ast.body)));

      case "Fun":
        return f(
          Fun(
            ast.body.lambdas.map(go),
            go(ast.body.result)));
      
      case "MetaTV":
        return f(
          MetaTV(
            ast.name,
            ast.scope,
            ast.position,
            ast.body.map(go)));

      case "Native": return f(
        Native(
          ast.cons,
          ast.body.map(go)));

      case "Nea": return f(Nea(go(ast.body)));
      
      case "Obj": return f(
        Obj(
          ast.cons,
          ast.props,
          ast.row,
          ast.body.map(({k, v}) => ({k, v: go(v)}))));

      case "Partial": return f(Partial);

      case "RigidTV":
        return f(
          RigidTV(
            ast.name,
            ast.scope,
            ast.position,
            ast.body.map(go)));

      case "Tconst": return f(Tconst(ast.name));
      
      case "This": {
        if (ast.nesting === 0)
          return f(This(ast.nesting, {body: go(ast.body)}));

        else return ast;
      }

      case "Tup": return f(Tup(
        ast.size,
        ast.body.map(go)));

      default: throw new TypeError(
        "internal error: unknown value constructor at mapAst");
    }
  };

  return go;
};


/* If a subtree of an AST is extratced it might contain redundant `Forall`
elements, which need to be deleted. Instead of traversing the tree and
conducting the necessary transfomrations we just recreate the AST. */

const recreateAst = ast =>
  parseAnno(serializeAst(ast))


const reduceAst = (f, init) => {
  const go = (acc, ast) => {
    switch (ast[TAG]) {
      case "Adt": return f(ast.body.reduce((acc_, field) =>
        go(acc_, field), acc), ast);

      case "Arg0": return acc;
      
      case "Arg1":
      case "Argv": return go(acc, ast[0]);
      
      case "Args":
      case "Argsv": return ast.reduce(
        (acc_, arg) => go(acc_, arg), acc);
      
      case "Arr": return f(go(acc, ast.body), ast);
      
      case "BoundTV":
        return ast.body.length === 0
          ? f(acc, ast)
          : f(ast.body.reduce(
              (acc_, field) => go(acc_, field), acc), ast);
      
      case "Forall": return f(go(acc, ast.body), ast);
      
      case "Fun": {
        acc = ast.body.lambdas.reduce((acc_, lambda) =>
          go(acc_, lambda), acc);

        return f(go(acc, ast.body.result), ast);
      }
      
      case "MetaTV":
        return ast.body.length === 0
          ? f(acc, ast)
          : f(ast.body.reduce(
              (acc_, field) => go(acc_, field), acc), ast);

      case "Native": return f(ast.body.reduce((acc_, field) =>
        go(acc_, field), acc), ast);

      case "Nea": return f(go(acc, ast.body), ast);
      
      case "Obj": return f(ast.body.reduce((acc_, {k, v}) =>
        go(acc_, v), acc), ast);

      case "Partial": return f(acc, ast);
      
      case "RowType": return f(ast.body.reduce((acc_, {k, v}) =>
        go(acc_, v), acc), ast);

      case "RowVar": return f(acc, ast);

      case "RigidTV":
        return ast.body.length === 0
          ? f(acc, ast)
          : f(ast.body.reduce(
              (acc_, field) => go(acc_, field), acc), ast);
      
      case "Tconst": return f(acc, ast);

      case "This": {
        if (ast.nesting === 0)
          return f(go(acc, ast.body), ast);

        else return acc;
      }
      
      case "Tup": return f(ast.body.reduce((acc_, field) =>
        go(acc_, field), acc), ast);

      default: throw new TypeError(
        "internal error: unknown value constructor at reduceAst");
    }
  };

  return ast => go(init, ast);
};


/* Removes the leftmost formal parameter of a function type after it was applied
to an argument type. */

const remParams = ast => {

  // the function returns the result value

  if (ast.body.body.lambdas.length === 1)
    return ast.body.body.result;

  // the function returns another one expecting more arguments

  else
    return Forall(
      new Set(),
      ".",
      Fun(
        ast.body.body.lambdas.slice(1),
        ast.body.body.result));
};


// remove the optional top-level quantifier of a function type

const remQuant = anno => { // TODO: wrong, don't just remove the quantifier!!
  if (anno === "()")
    return anno;

  else if (anno[0] !== "(" || anno[anno.length - 1] !== ")")
    return anno;

  else
    return anno.replace(new RegExp("^\\((?:\\^[^.]+\\. )?", ""), "")
      .replace(/\)$/, "");
};


/******************************************************************************
*******************************************************************************
**********************************[ PARSING ]**********************************
*******************************************************************************
******************************************************************************/


const parseAnno = anno => {
  const go = (cs, lamIndex, argIndex, scope, position, context, thisAnno, nesting) => {

    /* The `position` argument denotes whether a function argument is in domain
    or codomain position. Depending on this value a function type is wrapped in
    parenthesis (domain) or not (codomain) during substitution.

    The `context` argument is used to prevent both, impredicative polymorphism
    and function types without a surrounding quantifer/boundaries. The former is
    only allowed on the LHS of the function type. The latter is necessary to
    keep the language syntax simple.

    The `thisAnno` and `nesting` arguments are required to handle `this*`
    annotations. The former holds the entire object annotation `this*` refers
    to and the latter prevents the parser to get stuck in an infinite loop
    while parsing `this*`. */

    /* Annotation might contain type constructors whose type parameters are not
    fully specified. While for some types the arity is well-known and fixed
    (`Adt`, `Native`, Array, NEArray), others must use appropiate syntax to
    maintain their arity (e.g. `Function`, Tuple`). The following
    manifestations are possible:

    Adt: Either / Either<foo> / Either<foo, bar>
    Array/NEArray: [] / [1] / [foo] / [1foo]
    Function: (=>) / (foo =>) / (, =>) / (foo, =>) / (,, =>) / (foo,, =>) / (foo, bar, =>)
    Native: Map / Map<foo> / Map<foo, bar>
    Object: /
    Tcons t<foo, bar>: t / t<foo> / t<foo, bar>
    Tuple: [,] / [foo,] / [,,] / [foo,,] / [foo, bar,]

    All types constrcutors must be applied from left to right, that is to say
    `[, Bar]` is invalid. Objects are unordered and thus are incompatible with
    partial application.

    Partially specified type constructors are represented with the `__` constant.
    During serialization `__` is replaced with the empty string which leads to the
    above syntax forms depending on the type at hand. */

    const simplifiedType = remNestings(cs);
    let rx;

    // Fun

    if (simplifiedType.search(new RegExp("( |^)=>( |$)", "")) !== NOT_FOUND) {

      /* Every function type must be wrapped in parenthesis except for top-level
      functions, because at the top-level parenthesis are implicit. */

      if (context !== "" && context.split(/\//).slice(-1) [0] !== "Forall")
        throw new TypeError(cat(
          "malformed type annotation\n",
          `function type must be wrapped in "()"\n`,
          `but found "${cs}"\n`,
          `inside context "${context.split(/\//).slice(-1) [0]}"\n`,
          `in "${anno}"\n`));

      // check for invalid partially applied constructors
      
      else if (cs.search(/^=>./) !== NOT_FOUND) 
        throw new TypeError(cat(
          "malformed type annotation\n",
          "invalid partially applied type constructor\n",
          "partially application goes from left to right\n",
          `but "${cs}" received\n`,
          `in "${anno}"\n`));

      // check if the type constructor is not yet applied

      else if (cs.search(/^=>$/) !== NOT_FOUND)
        return Fun([Partial], Partial);

      /* If the type constructor is partially applied or not applied at all the
      missing type parameters must be denoted with "__" to simplify the parsing.
      "__" is just an interim representation only use dinternally by `parseAnno`. */

      else if (cs.search(/^=|>$/) !== NOT_FOUND)
        cs = cs.replace(/^=>/, "__ =>")
          .replace(/=>$/, "=> __");
            
      // split argument type(s) from rsult type

      const init = splitByPattern(/ => /, 4, remNestings(cs)) (cs),
        last = init.pop();

      // checks for variadic arguments in the result

      if (last.search(/^\.\./) !== NOT_FOUND)
        throw new TypeError(cat(
          "malformed type annotation\n",
          `illegal variadic syntax "${cs}"\n`,
          "at the result type\n",
          `in "${anno}"\n`));

      // create the AST element

      return Fun(

        // map over the arguments

        init.map((ds, i) => {
          
          // no-argument

          if (ds === "()")
            return new Arg0();

          else {

            // simplify syntax by removing nested structures

            const args = splitByPattern(/, /, 2, remNestings(ds)) (ds);

            // single parameter

            if (args.length === 1) {

              // normal parameter

              if (args[0].search(/^\.\./) === NOT_FOUND)
                return new Arg1(go(args[0], i, 0, scope, "domain", context + "/Function", thisAnno, nesting));

              // variadic parameter

              else
                return new Argv(go(args[0].slice(2), i, 0, scope, "domain", context + "/Function", thisAnno, nesting));
            }

            // multi parameter

            else {

              // rule out partially applied multi parameter type constructors

              if (ds.search(new RegExp("^,|, =>|,,", "")) !== NOT_FOUND)
                throw new TypeError(cat(
                  "malformed type annotation\n",
                  "invalid partially applied type constructor\n",
                  "multi-parameter functions must not be partially applied\n",
                  `but "${ds}" received\n`,
                  `in "${anno}"\n`));

              // rule out invalid variadic parameters

              args.forEach((arg, i) => {
                if (arg.search(/\.\./) !== NOT_FOUND && i < args.length - 1)
                  throw new TypeError(cat(
                    "malformed type annotation\n",
                    `illegal variadic argument "${cs}"\n`,
                    `at lambda #${lamIndex + 1} argument #${i + 1}\n`,
                    `in "${anno}"\n`));
              });

              // regular multi parameter

              if (args[args.length - 1].search(/\.\./) === NOT_FOUND)
                return Args.fromArr(
                  args.map((arg, j) => go(arg, i, j, scope, "domain", context + "/Function", thisAnno, nesting)));

              // multi parameter with trailing variadic one

              else return Argsv.fromArr(
                args.map((arg, j) => 
                  j === args.length - 1
                    ? go(arg.slice(2), i, j, scope, "domain", context + "/Function", thisAnno, nesting)
                    : go(arg, i, j, scope, "domain", context + "/Function", thisAnno, nesting)));
            }
          }
        }),

        // parse the result type

        go(last, -1, -1, scope, "codomain", context + "/Function", thisAnno, nesting));
    }

    // ADT/TC

    else if (adtDict.has((cs.match(new RegExp("^[A-Z][a-zA-Z0-9]*", "")) || [""]) [0])
      || tcDict.has((cs.match(new RegExp("^[A-Z][a-zA-Z0-9]*", "")) || [""]) [0])) {

        const dictRef = adtDict.has(cs.match(new RegExp("^[A-Z][a-zA-Z0-9]*", "")) [0])
          ? adtDict : tcDict;

        /* Check if the ADT is not yet applied or has no type parameters at all.
        Since ADT type constructor arity is hold in a map, we can restore it in
        place. */

        if (cs.search(/</) === NOT_FOUND)
          return Adt(cs, Array(dictRef.get(cs).arity).fill(Partial));

        else {

          // parse the type constructor components

          rx = cs.match(new RegExp("^(?<cons>[A-Z][A-Za-z0-9]*)<(?<fields>.+)>$", ""));

          // denote missing type parameters with "__"

          if (rx.groups.fields.search(new RegExp("^,|,,|,$", "")) !== NOT_FOUND)
            rx.groups.fields = rx.groups.fields
              .replace(/^,/, "__,")
              .replace(/,,/g, ", __, __")
              .replace(/,$/, ", __");

          // split type parameters

          const fields = splitByPattern(
            /, /, 2, remNestings(rx.groups.fields)) (rx.groups.fields);

          // check if parameter number corresponds with the stored arity

          if (fields.length > dictRef.get(rx.groups.cons).arity)
            throw new TypeError(cat(
              "malformed type annotation\n",
              `type constructor arity mismatch\n`,
              `defined type parameters: ${dictRef.get(rx.groups.cons).arity}\n`,
              `received type arguments: ${fields.length}\n`,
              `in "${anno}"\n`));

          // check for invalid partially applied type parameters
          
          fields.reduce((acc, field) => {
            if (field === "__") {
              if (acc)
                throw new TypeError(cat(
                  "malformed type annotation\n",
                  "invalid partially applied type constructor\n",
                  "partially application goes from left to right\n",
                  `but "${cs}" received\n`,
                  `in "${anno}"\n`));

              else return acc;
            }

            else return true;
          }, false);

          // create the AST element

          return Adt(
            rx.groups.cons,
            fields.map(field =>
              go(field, lamIndex, argIndex, scope, "", context + `/${rx.groups.cons}`, thisAnno, nesting)));
        }
    }

    // array like

    else if (rx = cs.match(new RegExp("^\\[(?:(?<nea>1))?(?<body>.*)\\]$", ""))) {

      // denote missing Array/NEArray type parameter with "__"

      if (rx.groups.body === "")
        rx.groups.body = "__";

      // denote missing Tuple type parameter with "__"

      else if (rx.groups.body.search(new RegExp(",(?:,|$)", "")) !== NOT_FOUND)
        rx.groups.body = rx.groups.body
          .replace(/^,/, "__,")
          .replace(/,,/g, ", __, __")
          .replace(/,$/, ", __");

      // simplify type

      const scheme = remNestings(rx.groups.body);

      // determine more specific type

      if (scheme.search(/,/) === NOT_FOUND) {

        // Arr

        if (rx.groups.nea === undefined)
          return Arr(go(rx.groups.body, lamIndex, argIndex, scope, "", context + "/Array", thisAnno, nesting));

        // Nea

        else
          return Nea(go(rx.groups.body, lamIndex, argIndex, scope, "", context + "/NEArray", thisAnno, nesting));
      }

      // Tup

      else {

        // split type parameters

        const fields = splitByPattern(/, /, 2, scheme) (rx.groups.body);

        // check for invalid partially applied type parameters

        fields.reduce((acc, field) => {
          if (field === "__") {
            if (acc)
              throw new TypeError(cat(
                "malformed type annotation\n",
                "invalid partially applied type constructor\n",
                "partially application goes from left to right\n",
                `but "${cs}" received\n`,
                `in "${anno}"\n`));

            else return acc;
          }

          else return true;
        }, false);

        // create AST element

        return Tup(
          fields.length,
          fields.map(field => go(field, lamIndex, argIndex, scope, "", context + "/Tuple", thisAnno, nesting)));
      }
    }

    // BoundTV

    else if (rx = cs.match(new RegExp("^(?<name>[a-z][A-Za-z0-9]*)$", ""))) {
      let selectedScope = "";

      /* Since scriptum supports higher-rank types we must decuce the scope of
      each TV from its synthactic position within the annotation. Each TV must
      be bound to the nearest scope whose quantifier lists a TV of the same name. */

      for (const locator of rntvs) {
        const [scope_, name] = locator.split(/:/);

        if (name === rx.groups.name
          && isParentScope(scope_, scope)
          && scope_.length > selectedScope.length)
            selectedScope = scope_;
      }

      // fall back to top-level scope

      if (selectedScope === "") {
        selectedScope = ".";

        // register rank-1 TV

        r1tvs.add(rx.groups.name);
      }

      /* Type variables in type parameter position that are fully polymorphic
      may turn out to have a specific arity due to partial application. Hence
      we must determine the maximal arity and kind of each one in a subsequent
      review. */

      if (!polyTcons.has(`${selectedScope}:${rx.groups.name}`))
        polyTcons.set(`${selectedScope}:${rx.groups.name}`, {arity: 0, kind: "*"});

      // create the bound TV

      return BoundTV(
        rx.groups.name, selectedScope, position, []);
    }

    // Forall

    else if (rx = cs.match(new RegExp("^\\((?:\\^(?<quant>[^\\.]+)\\. )?(?<body>.+)\\)$", ""))) {

      /* `Forall` elements are created by the parser as soon as the parsing
      process comes across round parenthesis, which have an ambiguous synthactic
      meaning. On the one hand they are used to denote nested, higher-rank
      quantifiers on the left side of a function type. On the other hand they
      are used as synthactic boundaries of the function type. Every function
      type except top-level ones require explicit parenthesis to simply parsing.
      `Forall` elements used as synthactic boundaries don't span their own scope
      and thus don't list any TVs or a specific scope.

      Scope is spanned by a `Forall` AST element. Each TV within this scope that
      is listed in the respective field of the `Forall` quantifier is bound to
      it. The rank of a scope is denoted as `.`. Its position in the parent scope
      is displayed by two digits separated by a slash. The first digit represents
      the index of a (curried) function sequence. The second one represents the
      index of a parameter list. The latter is necessary, because scriptum
      supports multi-argument functions. Here is an example:

      (^f, a. (^r.      (^b.        (b =>   a) => f<     b> =>      r) =>  r) => Coyoneda<f, a>)
        |  |    |         |          |      |     |      |          |      |              |  |
        ^  ^  ^^^^^   ^^^^^^^^^  ^^^^^^^^^  ^     ^  ^^^^^^^^^    ^^^^^  ^^^^^            ^  ^
        .  .  .0/0.   .0/0.0/0.  .0/0.0/0.  .     .  .0/0.0/0.    .0/0.  .0/0.            .  .
      
      */

      // synthactic boundaries of the function type

      if (rx.groups.quant === undefined)
        return Forall(
          new Set(), // empty
          "", // empty
          go(rx.groups.body, 0, 0, scope, "", context + "/Forall", thisAnno, nesting));

      // explicit rank-n quantifier

      else {

        // impredicative polymorphism

        if (context.replace(new RegExp("(?:/Forall)?/Function", "g"), "") !== "")
          throw new TypeError(cat(
            "malformed type annotation\n",
            `higher-rank quantifiers must only occur on the LHS of "=>"\n`,
            `but "${cs}" received\n`,
            "impredicative types are not yet supported\n",
            `inside context: ${context.split(/\//).slice(-1) [0]}\n`,
            `in "${anno}"\n`));

        else {
          const newScope = `${scope}${lamIndex}/${argIndex}.`,
            rntvs_ = new Set(rx.groups.quant.split(", "));

          rntvs_.forEach(rntv_ =>
            rntvs.add(`${newScope}:${rntv_}`));

          return Forall(
            rntvs_,
            newScope,
            go(rx.groups.body, 0, 0, newScope, "", context + "/Forall", thisAnno, nesting));
        }
      }
    }

    // Native

    else if (nativeDict.has((cs.match(new RegExp("^[A-Z][a-zA-Z0-9]*", "")) || [""]) [0])) {

      /* Check if the native type is not yet applied or has no type parameters
      at all. Since native type constructor arity is hold in a map, we can
      restore it in place. */

      if (cs.search(/</) === NOT_FOUND)
        return Native(cs, Array(nativeDict.get(cs).arity).fill(Partial));

      else {

        // parse the type constructor components

        rx = cs.match(new RegExp("^(?<cons>[A-Z][A-Za-z0-9]*)<(?<fields>.+)>$", ""));

        // denote missing type parameters with "__"

        if (rx.groups.fields.search(new RegExp("^,|,,|,$", "")) !== NOT_FOUND)
          rx.groups.fields = rx.groups.fields
            .replace(/^,/, "__,")
            .replace(/,,/g, ", __, __")
            .replace(/,$/, ", __");

        // split type parameters

        const fields = splitByPattern(
          /, /, 2, remNestings(rx.groups.fields)) (rx.groups.fields);

        // check if parameter number corresponds with the stored arity

        if (fields.length > nativeDict.get(rx.groups.cons).arity)
          throw new TypeError(cat(
            "malformed type annotation\n",
            "type constructor arity mismatch\n",
            `defined type parameters: ${nativeDict.get(rx.groups.cons).arity}\n`,
            `received type arguments: ${fields.length}\n`,
            `in "${anno}"\n`));

        // check for invalid partially applied type parameters
        
        fields.reduce((acc, field) => {
          if (field === "__") {
            if (acc)
              throw new TypeError(cat(
                "malformed type annotation\n",
                "invalid partially applied type constructor\n",
                "partially application goes from left to right\n",
                `but "${cs}" received\n`,
                `in "${anno}"\n`));

            else return acc;
          }

          else return true;
        }, false);

        // create the AST element

        return Native(
          rx.groups.cons,
          fields.map(field =>
            go(field, lamIndex, argIndex, scope, "", context + `/${rx.groups.cons}`, thisAnno, nesting)));
      }
    }

    // Obj

    else if (cs.search(new RegExp("^(?:[A-Z][A-Za-z0-9]* )?\\{"), "") !== NOT_FOUND) {

      // parse the optional constructor

      const cons = (cs.match(new RegExp("^[A-Z][A-Za-z0-9]*\\b", "")) || [null]) [0],
        ds = cons === null ? cs : cs.slice(cons.length + 1);

      // split properties

      const props = splitByPattern(
        /, /, 2, remNestings(ds.slice(1, -1))) (ds.slice(1, -1));

      // is it an empty object?

      if (props[0] === "") // empty {} | Foo {}
        return Obj(cons, [], null, []);

      // or an empty object with row variable?

      else if (props[0].search(new RegExp("^ \\| [a-z][A-Za-z0-9]*$", "")) === 0) // empty { | row} or Foo { | row}
        return Obj(
          cons,
          [],
          RowVar(props[0].match(new RegExp("(?<= \\| )[a-z][A-Za-z0-9]*$", "")) [0]),
          []);

      // or a regular object including fixed properties

      else {

        // initialize optional row variable

        let row = null

        // does it include a row variable?

        if (remNestings(props[props.length - 1]).search(/ \| /) !== NOT_FOUND) {

          // split row variable

          const [prop, row_] = splitByPattern(
            / \| /, 3, remNestings(props[props.length - 1])) (props[props.length - 1]);

          row = row_;
          props[props.length - 1] = prop;
        }

        // create AST element

        return Obj(
          cons,
          props.map(s => s.match(new RegExp("^([a-z][a-z0-9]*):", "i"), "") [1]),
          row === null ? null : RowVar(row),
          props.map(s => ({
            k: s.match(new RegExp("^([a-z][a-z0-9]*):", "i"), "") [1],
            v: go(s.replace(new RegExp("^[a-z][a-z0-9]*: ", "i"), ""), lamIndex, argIndex, scope, "", context + (cons ? `/${cons}` : "/Object"), cs, nesting)
          })));
      }
    }

    // Partial

    else if (rx = cs.match(/^__$/))
      return Partial;

    // Tcons (polymorphic type constructor)

    else if (rx = cs.match(new RegExp("^(?<name>[a-z][A-Za-z0-9]*)<(?<fields>.*)>$", ""))) {
      
      /* If a polymorphic type constructor is passed to another type constructor
      it can be either fully or partially applied. For the latter, like like in
      `Monad<m>` for instance, neither the arity nor the kind of the polymorphic
      type constructor can be determined in place. However, it can be
      reconstructed after parsing of the annotation is completed. Partially
      applied type constructors are only permitted in type parameter position. */

      // split type parameters

      const fields = splitByPattern(
        /, /, 2, remNestings(rx.groups.fields)) (rx.groups.fields);
      
      let selectedScope = "";

      /* Since scriptum supports higher-rank types we must resolve the scope of
      each type constructor from its synthactic position within the annotation. */

      for (const locator of rntvs) {
        const [scope_, name] = locator.split(/:/);

        if (name === rx.groups.name
          && isParentScope(scope_, scope)
          && scope_.length > selectedScope.length)
            selectedScope = scope_;
      }

      // fall back to top-level scope

      if (selectedScope === "") {
        selectedScope = ".";

        // register rank-1 TV

        r1tvs.add(rx.groups.name);
      }

      /* Type constructors in type parameter position may occur with varying
      arities at the annotation level due to partial application. Therefore we
      must determine the maximal arity and kind of each one  in a subsequent
      review. */

      if (polyTcons.has(`${selectedScope}:${rx.groups.name}`)) {
        if (fields.length > polyTcons.get(`${selectedScope}:${rx.groups.name}`).arity)
          polyTcons.set(`${selectedScope}:${rx.groups.name}`, {arity: fields.length, kind: "*"});
      }

      else
        polyTcons.set(`${selectedScope}:${rx.groups.name}`, {arity: fields.length, kind: "*"});

      // create the higher-kinded bound TV

      return BoundTV(
        rx.groups.name,
        selectedScope,
        position,
        fields.map(field =>
          go(field, lamIndex, argIndex, scope, "", context + `/${rx.groups.name}<..>`, thisAnno, nesting)));
    }

    // Tconst

    else if (rx = cs.match(new RegExp("^[A-Z][A-Za-z0-9]*$")))
      return Tconst(cs);

    // this*

    else if (rx = cs.search(/this\*/) !== NOT_FOUND) {
      if (thisAnno === null)
        throw new TypeError(cat(
          "malformed type annotation\n",
          `"this*" must refer to an object but no one in scope\n`,
          anno === cs ? "" : `in "${anno}"\n`));

      return This(nesting, {
        get body() {
          const thisAst = go(thisAnno, lamIndex, argIndex, scope, "", context, thisAnno, nesting + 1);
          delete this.body;
          return this.body = thisAst;
        }
      });
    }

    // TypeError

    else
      throw new TypeError(cat(
        "malformed type annotation\n",
        `unexpected token "${cs}"\n`,
        anno === cs ? "" : `in "${anno}"\n`));
  };

  const polyTcons = new Map(),
    r1tvs = new Set(),
    rntvs = new Set();

  // verify basic syntax rules of passed annotation

  verifyAnno(anno);

  // remove optional top-level parenthesis

  anno = remQuant(anno);

  // parse the annotation

  const ast = go(anno, 0, 0, ".", "", "", null, 0);

  /* TVs can be passed partially applied to type constructors, which is not
  obvious from annotations, except for tuples and multi-parameter functions.
  For this reason we must reconstruct the arity for each type parameter in
  post traversal. If a type constructor is higher-order, i.e. it receives
  another type constructor, we must ensure that it is invoked with the right
  kind:

  t<f> => t<(=>)> => f<a, b> -- accepted
  t<f> => t<(=>)> => f<a> -- rejected */

  // * make sure all partial kinds are compatible with the complete kind
  // * determine the complete kind for each partially applied type constructor
  // * we can also infere the real arity/kind of a partially type constructor from the kind of a known type constructor it is passed to
  // * forbid partially applied type constructors that are not in type parameter position

  let ast_ = mapAst(ast__ => {
    if (ast__[TAG] === "BoundTV") {
      if (polyTcons.has(`${ast__.scope}:${ast__.name}`)
        && ast__.body.length < polyTcons.get(`${ast__.scope}:${ast__.name}`).arity) {
          ast__.body = Object.assign([],
            Array(polyTcons.get(`${ast__.scope}:${ast__.name}`).arity).fill(Partial),
            ast__.body);

          return ast__;
      }

      else return ast__;
    }

    else return ast__;
  }) (ast);

  // TODO: arity/kind review
  
  /*ast_ = mapAst(ast__ => {
    switch (ast__[TAG]) {
      case "Adt":
      case "Arr":
      case "Nea":
      case "Fun":
      case "Native":
      case "Obj":
      case "Tup": {
        if (retrieveKind(ast__) !== inferKind(ast__))
          throw new TypeError(cat(
            "malformed type annotation\n",
            "type constructor kind mismatch\n",
            `expected: ${retrieveKind(ast__)}\n`,
            `received: ${inferKind(ast__)}\n`,
            `in "${anno}"\n`));

        else return ast__;
      }

      case "BoundTV": {
        // * if it is a type variabel of kind * w/o a specific arity
          // * is it passed to another type constructor
            // * can we reconstruct a higher-arity from the invoked type constructor?
          // * is there another occurrence of the same type variable that indicates a type constructor?
      }

      case "Tcons": {
        // * if it is an unknown polymorphic type constructor
          // * is it passed to another type constructor
            // * does the expected arity/kind of the invoked type constructor match with tha actual and maybe partially one?
          // * is there another occurrence of the same type constructor with a contradicting arity/kind?
      }
    }
  }) (ast);*/

  // if the AST includes type variables we need a quantifier

  if (r1tvs.size > 0)
    return Forall(r1tvs, ".", ast_);

  /* If the topmost level of the AST is a function type, we need synthactic,
  boundaries using round parenthesis. For the sake of simplicity we use the
  empty `Forall` element without bound TVs and scope. Please recall that
  function types always needs to be surrounded by round parenthesis to keep
  the syntax simple. */

  else if (ast_[TAG] === "Fun")
    return Forall(new Set(), ".", ast_);

  else return ast_;
};


// verifies the provided annotation using basic synthactic rules

const verifyAnno = s => {
  const scheme = remNestings(s);

  // prevent invalid chars

  if (s.search(new RegExp("[^a-z0-9(){}\\[\\]<>=:,\\| \\.\\^\\*]", "i")) !== NOT_FOUND) {
    const invalidChars = s.replace(new RegExp("[a-z(){}\\[\\]<>=:,1\\| \\.\\^]", "gi"), "");

    throw new TypeError(cat(
      "malformed type annotation\n",
      "illegal characters\n",
      `namely: ${invalidChars}\n`,
      `in "${s}"\n`));
  }

  // rule out Haskell style function types

  else if (s.search(/->/) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `"=>" denotes function types\n`,
      `but Haskell's "->" received\n`,
      `in "${s}"\n`));

  // ensure balanced bracket nesting

  else if (scheme.replace(/=>/g, "").search(new RegExp("[(\\[{<>}\\])]", "")) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      "bracket mismatch\n",
      `${showBracketMismatch(scheme)}\n`,
      `in "${s}"\n`));

  // prevent redundant round parenthesis

  else if (s.search(/\)\)/) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `redundant "(..)"\n`,
      `next to "${s.match(new RegExp(".{0,5}\\)\\)", "")) [0]}"\n`,
      `in "${s}"\n`));

  // prevent redundant pointed parenthesis

  else if (s.search(/<>/) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `redundant "<>"\n`,
      `next to "${s.match(new RegExp(".{0,5}<>.{0,5}", "")) [0]}"\n`,
      `in "${s}"\n`));

  // check for valid use of =>

  else if (s.replace(new RegExp("(?: |\\()=>( |\\))", "g"), "").search("=>") !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of "=>"\n`,
      "allowed synthactic forms:\n",
      "(foo => bar)\n",
      "(foo =>)\n",
      "(=>)\n",
      `in "${s}"\n`));

  // check for invalid use of =
  
  else if (s.search(new RegExp("=(?!>)", "")) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of "="\n`,
      `must only be used in "=>"\n`,
      `in "${s}"\n`));

  // check for invalid use of ,
  
  else if (s.search(new RegExp(",[^, \\]]", "")) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of ","\n`,
      "must only be used to enumerate names:\n",
      "foo, bar, baz\n",
      "or to denote partially applied type constructors:\n",
      "(, =>)\n",
      "[,,]\n",
      `in "${s}"\n`));

  // check for invalid use of ^
  
  else if (s.search(new RegExp("(?<!\\()\\^[a-z]", "")) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of "^"\n`,
      "must only be used in quantifiers:\n",
      "(^foo. foo => bar)\n",
      `in "${s}"\n`));

  // check for valid use of .

  else if (s.replace(new RegExp("[a-zA-Z0-9]\\. ", "g"), "").search(/\./) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of "."\n`,
      "must only be used in quantifiers:\n",
      "(^foo. foo => bar)\n",
      `in "${s}"\n`));

  // check for invalid use of <
  
  else if (s.search(new RegExp("(?<![a-zA-Z0-9])<", "")) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of "<"\n`,
      "must only be used in type constructors:\n",
      "foo<bar>\n",
      `in "${s}"\n`));

  // check for valid use of :
  
  else if (s.replace(new RegExp("\\b[a-z][a-z0-9]*: ", "gi"), "").search(":") !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of ":"\n`,
      "must only be used in objects:\n",
      "{foo: bar}\n",
      `in "${s}"\n`));

  // check for valid use of |

  else if (s.replace(new RegExp(/ \| [a-z]/g), "").search(/\|/) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of "|"\n`,
      "must only be used in objects to separate the row variable:\n",
      "{foo: bar | row}\n",
      `in "${s}"\n`));

  // check for valid use of ()

  else if (s.replace(new RegExp("\\(\\) =>", "g"), "").search(/\(\)/) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of "()"\n`,
      "must only be used for thunks:\n",
      "() => foo\n",
      `in "${s}"\n`));

  // check for valid use of 0-9

  else if (s.replace(new RegExp("\\b[a-z][a-z0-9]*\\b|\\[1", "gi"), "").search(/\d/) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      "invalid use of digits\n",
      "names must not start with a digit\n",
      `in "${s}"\n`));

  // prevent redundant spaces

  else if (s.search(new RegExp("  |^ | $", "")) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `redundant " "\n`,
      `next to "${s.match(new RegExp(".{0,5}(?:  |^ | $).{0,5}", "")) [0]}"\n`,
      `in "${s}"\n`));

  // check for valid use of *this

  else if (s.replace(new RegExp("\\bthis\\*", "g"), "").search(/\*/) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of "*"\n`,
      "must only be used to denote self referencing:\n",
      "{foo: (bar => this*)}\n",
      `in "${s}"\n`));

  // prevent explicit top-level quantifiers

  else if (s.search(/^\(\^/) !== NOT_FOUND
    && s.search(/\)$/) !== NOT_FOUND)
      throw new TypeError(cat(
        "malformed type annotation\n",
        "top-level type must be implicitly quantified\n",
        `but "${s.match(new RegExp("(?<=^\\()\\^[^.]+\\.", "")) [0]}" received\n`,
        `in "${s}"\n`));

  // prevent malformed variadic arguments

  else if (s.replace(new RegExp("\\.\\.\\[", "g"), "").search(/\.\./) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of ".."\n`,
      "must only be used in variadic arguments:\n",
      "..[Foo]\n",
      `in "${s}"\n`));

  // prevent malformed variadic arguments

  else if (s.search(/\.\.\./) !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `invalid use of "..."\n`,
      "variadic arguments expect only two dots:\n",
      "..[Foo]\n",
      `in "${s}"\n`));

  // check for valid use of " "

  else if (s.replace(/ => /g, "")
    .replace(/ =>/g, "")
    .replace(/, /g, "")
    .replace(/: /g, "")
    .replace(/ \| /g, "")
    .replace(new RegExp("[a-z0-9]\\. ", "gi"), "")
    .replace(new RegExp("[a-z0-9] \\{", "gi"), "")
    .search(" ") !== NOT_FOUND)
    throw new TypeError(cat(
      "malformed type annotation\n",
      `unexpected use of " "\n`,
      `in "${s}"\n`));

  return s;
};


/***[ Combinators ]***********************************************************/


/* Remove nested pairs of parenthesis to simplify parsing through regular
expressions. This is the reason why functions must always be nested in round
parenthesis, even though the syntax doesn't require them to be unambiguous. */

const remNestings = cs => {
  let ds;

  do {
    ds = cs;
    cs = cs.replace(/=>/g, "=="); // mask function arrows
    cs = cs.replace(new RegExp("\\([^(){}\\[\\]<>]*\\)", ""), s => "_".repeat(s.length)); // Fun
    cs = cs.replace(new RegExp("(?:[A-Z][A-Za-z0-9]* )?{[^(){}\\[\\]<>]*}", ""), s => "_".repeat(s.length)); // Obj
    cs = cs.replace(new RegExp("\\[[^(){}\\[\\]<>]*\\]", ""), s => "_".repeat(s.length)); // Arr + Nea + Tup
    cs = cs.replace(new RegExp("[A-Z][A-Za-z0-9]*<[^(){}\\[\\]<>]*>", ""), s => "_".repeat(s.length)); // Adt + Native
    cs = cs.replace(new RegExp("\\b[a-z][A-Za-z0-9]*<[^(){}\\[\\]<>]*>", ""), s => "_".repeat(s.length)); // Tcons
    cs = cs.replace(/==/g, "=>"); // unmask function arrows
  } while (ds !== cs);

  return cs;
};


const showBracketMismatch = s => {
  if ((s.match(/\{|\}/g) || []).length % 2 !== 0)
    return `missing/redundant: "{" or "}"`;

  else if ((s.replace(/=>/g, "").match(/<|>/g) || []).length % 2 !== 0)
    return `missing/redundant: "<" or ">"`;

  else if ((s.match(/\(|\)/g) || []).length % 2 !== 0)
    return `missing/redundant: "(" or ")"`;

  else if ((s.match(/\[|\]/g) || []).length % 2 !== 0)
    return `missing/redundant: "[" or "]"`;

  else return `missing "()" around function argument`;
};


/* Take one level of an annotation and splits it at each position where a
subterm is found. */

const splitByPattern = (rx, delimLen, ref) => cs => {
  const xs = ref.split(rx), ys = [];
  let len = 0;

  xs.forEach((s, i) => {
    ys.push(cs.slice(len, len + s.length));
    len = len + delimLen + s.length;
  });

  return ys;
};


/******************************************************************************
*******************************************************************************
*******************************[ SERIALIZATION ]*******************************
*******************************************************************************
******************************************************************************/


// opposite of `parseAnno`

const serializeAst = initialAst => {
  const go = ast => {
    switch (ast[TAG]) {
      case "Adt": {
        const body = ast.body.map(go).join(", ")
          .replace(/(?:, )?__/g, "")
          .replace(/,+$/, "");

        return cat(
          ast.cons,
          body === ""
            ? ""
            : `<${body}>`);
      }

      case "Arr": return ast.body[TAG] === "Partial"
        ? `[]`
        : `[${go(ast.body)}]`;
      
      case "BoundTV":
      case "MetaTV":
      case "RigidTV": {

        if (ast.body.length === 0)
          return ast.name;

        // Tcons (higher-kinded)

        else  {
          const body = ast.body.map(go).join(", ")
            .replace(/(?:, )?__/g, "");

          return cat(
            ast.name,
            body.length ? `<${body}>` : "");
        }
      }

      case "Forall": {
        if (ast.scope === "." || ast.scope === "")
          return cat(
            "(",
            go(ast.body),
            ")");

        else return cat(
          "(^",
          Array.from(ast.btvs).join(", "),
          ". ",
          go(ast.body),
          ")");
      }

      case "Fun": {
        const domain = ast.body.lambdas.map(args => {
          switch (args[TAG]) {
            case "Arg0": return "()";
            case "Arg1": return go(args[0]);
            case "Args": return args.map(go).join(", ");
            
            case "Argsv": return args.map((arg, i) =>
              i === args.length - 1
                ? `..${go(arg)}`
                : go(arg))
                  .join(", ");
            
            case "Argv": return `..${go(args[0])}`;

            default:
              throw new TypeError(
                "internal error: illegal argument list");
          }
        }).join(" => ");

        const codomain = go(ast.body.result);

        return `${domain} => ${codomain}`
          .replace(/ ?__/g, "")
          .replace(/^ =>|=> $/, "=>");
      }
      
      case "Native": {
        const body = ast.body.map(go).join(", ")
          .replace(/(?:, )?__/g, "")
          .replace(/,+$/, "");

        return cat(
          ast.cons,
          body === ""
            ? ""
            : `<${body}>`);
      }

      case "Nea": return ast.body[TAG] === "Partial"
        ? `[1]`
        : `[1${go(ast.body)}]`;

      case "Obj": {
        const props = ast.body.map(({k, v}) =>
          v[TAG] === "Partial"
            ? {k} : {k, v});

        const row = ast.row === null ? ""
          : ast.row[TAG] === "RowVar" ? " | " + ast.row.name
          : ", " + ast.row.body.map(({k, v}) =>
              `${k}: ${go(v)}`).join(", ");

        return cat(
          ast.cons === null ? "" : `${ast.cons} `,
          "{",
          props.map(({k, v}) =>
            v === undefined
              ? `${k}:`
              : `${k}: ${go(v)}`).join(", "),
          row,
          "}");
      }

      case "Partial": return "__";
      
      case "RowType": return ast.body.map(
        ({k, v}) => `${k}: ${go(v)}`).join(", ");
      
      case "RowVar": return ast.name;
      case "This": return "this*";

      case "Tup": {
        const body = ast.body.map(go).join(", ")
          .replace(/ ?__/g, "");

        return cat(`[${body}]`);
      }

      case "Tconst": return ast.name;

      default:
        throw new TypeError(
          "internal error: unknown value constructor at serializeAst");
    }
  };

  // remove optional top-level parenthesis

  return remQuant(go(initialAst));
};


/******************************************************************************
*******************************************************************************
*******************************[ INTROSPECTION ]*******************************
*******************************************************************************
******************************************************************************/


export const introspectFlat = x => {
  const type = Object.prototype.toString.call(x).slice(8, -1);

  switch (type) {
    case "Date": {
      if (x.getTime() === Number.NaN)
        return "Undefined";

      else return type;
    }

    case "Number": {
      if (x === Number.NaN)
        return "Undefined";

      else if (x === Number.POSITIVE_INFINITY || x === Number.NEGATIVE_INFINITY)
        return "Undefined";

      else if (x < Number.MIN_SAFE_INTEGER || x > Number.MAX_SAFE_INTEGER)
        return "Undefined";

      else return type;
    }

    case "Object": {
      if (Symbol.toStringTag in x && x[Symbol.toStringTag] !== "Object")
        return x[Symbol.toStringTag];

      else if ("constructor" in x && x.constructor.name !== "Object")
        return x.constructor.name;

      else return type;
    }

    /* `Undefined` usually immediately leads to runtime termination unless it
    is a function argument, because nullary functions implicitly pass
    `Undefined`. */

    case "Undefined":
      throw new TypeError(cat(
        "illegal type introspection\n",
        "namely: undefined\n",
        `runtime immediately terminated\n`));

    default: return type;
  }
};


/* `introspectDeep` is an imperative stateful function. It creates a closure
that holds some state and can pass this closure to other functions to share
this state. The type validator relies on vanilla Javascript and thus needs to
fall back to elusive side effects every now and then. */

export const introspectDeep = state => {
  const go = x => {

    // retrieve the native Javascript type

    const type = introspectFlat(x);

    // inspect the value recursively

    switch (type) {
      case "Array": {
        const ts = new Set();
        x.forEach(y => ts.add(go(y)));

        if (ts.size === 0)
          return `[${String.fromCharCode(state.charCode++)}]`;

        else if (ts.size > 1)
          throw new TypeError(cat(
            "invalid Array\n",
            "must contain homogeneous elements\n",
            `but elements of type "${Array.from(ts).join(", ")}" received`,
            "\n"));

        else return `[${Array.from(ts) [0]}]`;
      }

      case "Function": {

        /* Functions are an opaque value, therefore they need an explicit user
        defined type annotation. The top-level quantifier is implicit but can
        still be provided by the user. Both forms must be taken into account. */

        if (ANNO in x) {
          if (x[ANNO] [0] !== "(" || x[ANNO] [x[ANNO].length - 1] !== ")")
            return `(${x[ANNO]})`;

          else return x[ANNO];
        }

        /* If a function is untyped, the introspection returns a native Javascript
        `Function` constant. This behavior gives rise to type holes or untyped
        sections in the type validator. If this is a feature or a design mistake
        isn't clear yet. */

        else return type;
      }

      case "NEArray": {
        const ts = new Set();
        x.forEach(y => ts.add(go(y)));

        if (ts.size === 0
          || ts.size === 1 && ts.has("Undefined"))
            throw new TypeError(cat(
              "invalid NEArray\n",
              "must contain at least a single element\n"));

        else if (ts.size > 1)
          throw new TypeError(cat(
            "invalid NEArray\n",
            "must contain homogeneous elements\n",
            `but elements of type "${Array.from(ts).join(", ")}" received`,
            "\n"));

        else return `[1${Array.from(ts) [0]}]`;
      } 

      case "Tuple": {
        const ts = [];
        x.forEach(y => ts.push(go(y)));
        return `[${Array.from(ts).join(", ")}]`;
      }

      /* `Undefined` usually immediately leads to runtime termination unless it
      is a function argument, because nullary functions implicitly pass
      `Undefined`. */

      case "Undefined":
        throw new TypeError(cat(
          `value of type "Undefined" received\n`,
          "runtime immediately terminated\n"));

      default: {

        // object-based type constant (e.g. `Integer` or `Char`)

        if (monoDict.has(type))
          return type;

        /* Native types are imperative Javascript types, i.e. they are not
        algebraic. They comprise both built-in and custom types. It must be
        defined for every native type how introspection works. Since such
        introspection might introduce further TVs, it must be stateful as well. */

        else if (nativeDict.has(type))
          return nativeIntrospection.get(type) (x, state, go);

        // Thunk (lookup doesn't trigger thunk evaluation)

        else if (x !== null && x[THUNK])
          return x[ANNO];

        // ADT or Object

        else if (x !== null && typeof x === "object" || typeof x === "function") {

          // ADT

          if (ADT in x) return x[ADT];

          // Object

          else {
              const ts = new Map();

              const cons = TAG in x
                ? `${x[TAG]} ` : "";

              for (let k in x)
                ts.set(k, go(x[k]));

              return `${cons}{${Array.from(ts).map(([k, v]) => k + ": " + v).join(", ")}}`;
          }
        }

        // Tconst

        else return type;
      }
    }
  };

  // remove optional top-level parenthesis

  return y => {
    const r = go(y);

    if (r[0] === "(" && r[r.length - 1] === ")")
      return r.slice(1, -1);

    else return r;
  };
};


/******************************************************************************
*******************************************************************************
****************************[ ALGEBRAIC DATA TYPE ]****************************
*******************************************************************************
******************************************************************************/


/* `type` is used for declaring general ADTs including several value constructors.
Type dictionaries based on Javascript objects are used to allow an exhaustiveness
check and to facilitate pattern matching. */

export const type = adtAnno => {

  // bypass the type validator

  if (CHECK === false)
    return o => ({run: o});

  // strip newlines and indentations

  adtAnno = adtAnno.replace(new RegExp("[ \\t]*\\r\\n[ \\t]*|[ \\t]*\\n[ \\t]*", "g"), "")
    .replace(new RegExp(SAFE_SPACE, "g"), " ");

  // ensures top-level function type

  if (remNestings(adtAnno).search(/ => /) === NOT_FOUND)
    throw new TypeError(cat(
      "invalid algebraic data type declaration\n",
      "top-level type must be a function\n",
      `while declaring "${adtAnno}"\n`));

  // separate domain from codomain

  const [domainAnno, codomainAnno] = splitByPattern(
    / => /, 4, remNestings(adtAnno)) (adtAnno);

  // determine name of the codomain

  const tcons = codomainAnno.match(/[^<]+/) [0];

  // verify codomain

  if (tcons.search(new RegExp("^[A-Z][A-Z-a-z0-9]*", "")) === NOT_FOUND)
    throw new TypeError(cat(
      "invalid algebraic data type declaration\n",
      "RHS of the top-level function type must be a type constructor\n",
      `but "${codomainAnno}" received\n`,
      `while declaring "${adtAnno}"\n`));

  // determine arity of the codomain

  const arity = codomainAnno !== tcons
    ? splitByPattern(
        /, /, 2, remNestings(codomainAnno.replace(new RegExp("^[^<]+<|>$", "g"), "")))
          (codomainAnno.replace(new RegExp("^[^<]+<|>$", ""), "g")).length
    : 0;

  // check for name clashes with existing ADTs

  if (adtDict.has(tcons))
    throw new TypeError(cat(
      "illegal algebraic data type declaration\n",
      "name collision with another ADT found\n",
      `namely: ${tcons}\n`,
      `while declaring "${adtAnno}"\n`));

  // check for name clashes with existing TCs

  else if (tcDict.has(tcons))
    throw new TypeError(cat(
      "illegal algebraic data type declaration\n",
      "name collision with a type class found\n",
      `namely: ${tcons}\n`,
      `while declaring "${tcAnno}"\n`));

  // check for name clashes with existing native types

  else if (nativeDict.has(tcons))
    throw new TypeError(cat(
      "illegal algebraic data type declaration\n",
      "name collision with a native type found\n",
      `namely: ${tcons}\n`,
      `while declaring "${adtAnno}"\n`));

  // check for name clashes with existing type constants

  else if (monoDict.has(tcons))
    throw new TypeError(cat(
      "illegal algebraic data type declaration\n",
      "name collision with a type constant found\n",
      `namely: ${tcons}\n`,
      `while declaring "${adtAnno}"\n`));

  // pre-register ADT using a default kind

  else adtDict.set(tcons, {arity, kind: "*"});

  // parse ADT

  let adtAst = parseAnno(adtAnno);

  // determine the kind of the codomain and update the ADT registry

  const kind = inferKind(adtAst.body.body.result);

  adtDict.set(tcons, {arity, kind});

  // verify the domain is a rank-2 function argument

  if (adtAst.body.body.lambdas[0] [0] [TAG] !== "Forall"
    || adtAst.body.body.lambdas[0] [0].btvs.size === 0)
      throw new TypeError(cat(
        "invalid algebraic data type declaration\n",
        "LHS of the top-level function type must be\n",
        "a rank-1 function type argument\n",
        `but "${domainAnno}" received\n`,
        `while declaring "${adtAnno}"\n`));

  /* Verify the function argument expects a type dictionary with at least one
  property. */

  else if (adtAst.body.body.lambdas[0] [0].body.body.lambdas[0] [0] [TAG] !== "Obj"
    || adtAst.body.body.lambdas[0] [0].body.body.lambdas[0] [0].props.length === 0)
      throw new TypeError(cat(
        "invalid algebraic data type declaration\n",
        "LHS of the top-level function type must be\n",
        "a rank-1 function type argument\n",
        "expecting a type dictionary with at least one property\n",
        `but "${domainAnno}" received\n`,
        `while declaring "${adtAnno}"\n`));

  /* Verify that all rank-1 TVs in the domain occur in the codomain of the
  value constructor:

  (^r. {left: (a => r), right: (b => r)} => Either<a, b>
               ^                ^                  ^^^^
  (^r. {none: r, some: (a => r)} => Option<a>
                        ^                  ^ */

  // collect all rank-1 TVs in the domain

  const tvsDomain = reduceAst((acc, ast) => {
    if (isTV(ast) && ast.scope === ".") {
      acc.add(ast.name);
      return acc;
    }

    else return acc;
  }, new Set()) (adtAst.body.body.lambdas[0] [0]);

  // collect all rank-1 TVs in the codomain

  const tvsCodomain = reduceAst((acc, ast) => {
    if (isTV(ast) && ast.scope === ".") {
      acc.add(ast.name);
      return acc;
    }

    else return acc;
  }, new Set()) (adtAst.body.body.result);

  // lookup possible differences

  tvsDomain.forEach((v, k) => {
    if (!tvsCodomain.has(k))
      throw new TypeError(cat(
        "illegal algebraic data type declaration\n",
        `type parameter "${k}" only occurs on the RHS\n`,
        "existential types are not yet supported\n",
        `while declaring "${adtAnno}"\n`));
  });

  // create the continuation type

  const domainAst = recreateAst(adtAst.body.body.lambdas[0] [0]);

  /***********************
   * ALGEBRAIC DATA TYPE *
   ***********************/

  // data constructor

  const dataCons = k => { // k is the continuation containing a type dictionary

    // ensure untyped continuation argument

    if (typeof k !== "function")
      throw new TypeError(cat(
        "algebraic data type error\n",
        "invalid value constructor argument\n",
        "expected: function\n",
        `received: ${introspectDeep(k)}\n`,
        `while applying "${adtAnno}"\n`));

    else if (ANNO in k)
      throw new TypeError(cat(
        "algebraic data type error\n",
        "invalid value constructor argument\n",
        "expected: untyped function\n",
        `received: ${k[ANNO]}\n`,
        `while applying "${adtAnno}"\n`));

    // set the domain annotation

    k[ANNO] = serializeAst(domainAst);

    // return the ADT

    return {
      [TAG]: tcons,
      [ADT]: codomainAnno,
      run: k
    };
  };

  // set the annotation and return the data constructor

  dataCons[ANNO] = adtAnno;
  return dataCons;
};


/* `type1` declares ordinary ADTs without type refinements and with only one
value constructor. Hence neither pattern matching nor exhaustiveness checking
is required. */

export const type1 = adtAnno => {

  // bypass the type validator

  if (CHECK === false)
    return x => ({run: x});

  // strip newlines and indentations

  adtAnno = adtAnno.replace(new RegExp("[ \\t]*\\r\\n[ \\t]*|[ \\t]*\\n[ \\t]*", "g"), "")
    .replace(new RegExp(SAFE_SPACE, "g"), " ");

  // verify top-level function type

  if (remNestings(adtAnno).search(/ => /) === NOT_FOUND)
    throw new TypeError(cat(
      "invalid algebraic data type declaration\n",
      "top-level type must be a function\n",
      `while declaring "${adtAnno}"\n`));

  // separate domain from codomain

  const [domainAnno, codomainAnno] = splitByPattern(
    / => /, 4, remNestings(adtAnno)) (adtAnno);

  // determine name of the codomain

  const tcons = codomainAnno.match(/[^<]+/) [0];

  // verify codomain

  if (tcons.search(new RegExp("^[A-Z][A-Z-a-z0-9]*", "")) === NOT_FOUND)
    throw new TypeError(cat(
      "invalid algebraic data type declaration\n",
      "RHS of the top-level function type must be a type constructor\n",
      `but "${codomainAnno}" received\n`,
      `while declaring "${adtAnno}"\n`));

  // determine arity of the codomain

  const arity = codomainAnno !== tcons
    ? splitByPattern(
        /, /, 2, remNestings(codomainAnno.replace(new RegExp("^[^<]+<|>$", "g"), "")))
          (codomainAnno.replace(new RegExp("^[^<]+<|>$", ""), "g")).length
    : 0;

  // check for name clashes with existing ADTs

  if (adtDict.has(tcons))
    throw new TypeError(cat(
      "illegal algebraic data type declaration\n",
      "name collision with another ADT found\n",
      `namely: ${tcons}\n`,
      `while declaring "${adtAnno}"\n`));

  // check for name clashes with existing TCs

  else if (tcDict.has(tcons))
    throw new TypeError(cat(
      "illegal algebraic data type declaration\n",
      "name collision with a type class found\n",
      `namely: ${tcons}\n`,
      `while declaring "${tcAnno}"\n`));

  // check for name clashes with existing native types

  else if (nativeDict.has(tcons))
    throw new TypeError(cat(
      "illegal algebraic data type declaration\n",
      "name collision with a native type found\n",
      `namely: ${tcons}\n`,
      `while declaring "${adtAnno}"\n`));

  // check for name clashes with existing type constants

  else if (monoDict.has(tcons))
    throw new TypeError(cat(
      "illegal algebraic data type declaration\n",
      "name collision with a type constant found\n",
      `namely: ${tcons}\n`,
      `while declaring "${adtAnno}"\n`));

  // pre-register ADT using a default kind

  else adtDict.set(tcons, {arity, kind: "*"});

  // parse ADT

  let adtAst = parseAnno(adtAnno);

  // determine the kind of the codomain and update the ADT registry

  const kind = inferKind(adtAst.body.body.result);

  adtDict.set(tcons, {arity, kind});

  /* Verify that all rank-1 TVs of the domain occur in the codomain of the
  value constructor:

  ((a => r) => r => Cont<a, r>)
    ^    ^     ^         ^^^^ */

  // collect all rank-1 TVs within the domain

  const tvsDomain = reduceAst((acc, ast) => {
    if (isTV(ast) && ast.scope === ".") {
      acc.add(ast.name);
      return acc;
    }

    else return acc;
  }, new Set()) (adtAst.body.body.lambdas[0] [0]);

  // collect all rank-1 TVs within the codomain

  const tvsCodomain = reduceAst((acc, ast) => {
    if (isTV(ast) && ast.scope === ".") {
      acc.add(ast.name);
      return acc;
    }

    else return acc;
  }, new Set()) (adtAst.body.body.result);

  // lookup possible differences

  tvsDomain.forEach((v, k) => {
    if (!tvsCodomain.has(k))
      throw new TypeError(cat(
        "illegal algebraic data type declaration\n",
        `type parameter "${k}" only occurs on the RHS\n`,
        "existential types are not yet supported\n",
        `while declaring "${adtAnno}"\n`));
  });

  /***********************
   * ALGEBRAIC DATA TYPE *
   ***********************/

  // data constructor

  const dataCons = x => {

    let tvid = 0,
      instantiations = new Map(),
      aliases = new Map(),
      intros = [];

    // determine the type of the passed argument

    const argAnno = introspectDeep({charCode: letterA}) (x),
      argAst = parseAnno(argAnno);

    // dequantify ADT AST considering TV introductions

    let intro;

    ({ast: adtAst, intro} = specializeLHS(new Map(), ".") (adtAst));

    if (intro.size > 0) intros.push(intro);

    // unify the function type application

    ({tvid, instantiations, aliases, intros} = unifyTypes(
      adtAst.body.body.lambdas[0] [0],
      argAst,
      0,
      0,
      {tvid, instantiations, aliases, intros},
      domainAnno,
      argAnno,
      adtAnno,
      [argAnno]));

    // disclose transitive relations

    ({tvid, instantiations, aliases, intros} = uncoverTransRel(
      {tvid, instantiations, aliases, intros}, null, null, adtAnno, [argAnno]));

    // remove contradictory instantiations

    instantiations = remConflictingAliases(instantiations);

    // conduct occurs check

    instantiations.forEach(m => {
      m.forEach(({key: keyAst, value: valueAst}) =>
        occursCheck(keyAst, valueAst, instantiations, aliases, new Set(), null, null, adtAnno, [argAnno]));
    });

    // substitute ADT AST without removing the type parameter

    adtAst = 
      substitute(
        adtAst,
        instantiations);

    /* If the argument of the data constructor is a function, then update
    its annotation with the substituted one. */

    if (x && x[ANNO]) {
      x[ANNO] = serializeAst(
        prettyPrint(
          recreateAst(adtAst.body.body.lambdas[0] [0])));
    }

    // update the codomain annotation with the substituted one

    const codomainAnno_ = serializeAst(
      prettyPrint(
        recreateAst(adtAst.body.body.result)));

    // return the ADT

    return {
      [TAG]: tcons,
      [ADT]: codomainAnno_,
      run: x
    };
  };

  // set the annotation and return the data constructor

  dataCons[ANNO] = adtAnno;
  return dataCons;
};


/******************************************************************************
********************************[ TYPE CLASS ]*********************************
******************************************************************************/


/* Declare type classes purely at the value level. They are encoded as dicts
including the operations of the respective type class. They resemble ADTs
quite a lot, hence the also rely on ADTs. */

export const typeClass = tcAnno => {

  // bypass the type validator

  if (CHECK === false) {
    return (...os) => o => {
      o = Object.assign({}, o); // clone
      os.forEach(p => o = Object.assign(o, p));
      return o;
    }
  }

  // strip newlines and indentations

  tcAnno = tcAnno.replace(new RegExp("[ \\t]*\\r\\n[ \\t]*|[ \\t]*\\n[ \\t]*", "g"), "")
    .replace(new RegExp(SAFE_SPACE, "g"), " ");

  // determine TC components

  const tcCompos = splitByPattern(
    / => /, 4, remNestings(tcAnno)) (tcAnno);

  // determine TC constaints

  const constraints = [];

  // verify top-level function type

  if (tcCompos.length === 1)
    throw new TypeError(cat(
      "invalid type class declaration\n",
      "top-level type must be a function\n",
      `while declaring "${tcAnno}"\n`));

  // verify constraints are passed as multi-parameter

  else if (tcCompos.length > 3)
    throw new TypeError(cat(
      "invalid type class declaration\n",
      "malformed constraints\n",
      "constraints must be passed as a single multi-parameter argument\n",
      `while declaring "${tcAnno}"\n`));

  else if (tcCompos.length === 3) {

    // validate constraints

    if (tcCompos[0].search(new RegExp(
      "^(?:[A-Z][A-Za-z0-9]*<[a-z][A-Za-z0-9]*>, )*[A-Z][A-Za-z0-9]*<[a-z][A-Za-z0-9]*>$", "")) === NOT_FOUND)
        throw new TypeError(cat(
          "invalid type class declaration\n",
          "malformed constraints\n",
          "comma separated constraint list expected\n",
          `but "${tcCompos[0]}" received\n`,
          `while declaring "${tcAnno}"\n`));

    // parse constraints and retrieve their components

    tcCompos[0].split(", ").forEach((constraint, i) => {
      const tcons = constraint.replace(/<.+>$/, ""),
        tparamTo = constraint.split(/</) [1].slice(0, -1);

      if (!tcDict.has(tcons))
        throw new TypeError(cat(
          "invalid type class declaration\n",
          "malformed constraints\n",
          "list of existing type class constraints expected\n",
          `but unknown "${tcons}" received\n`,
          `while declaring "${tcAnno}"\n`));

      else {

        // retrieve components of the constraining TC from global TC dictionary

        const {tparam: tparamFrom, tcAnno, arity, kind} = tcDict.get(tcons);

        /* Store the type constructor, type parameter and the dictionary
        annotation. There are actually two type parameters involved: The first
        one represents the type parameter used in the current type class
        declaration. The second one is used in the constraining type class. If
        both differ, they must be unified before being added to the current TC. */

        constraints[i] = {
          tcons,
          tparamFrom,
          tparamTo,
          tcAnno
        };
      }
    });
  }

  // verify codomain

  const codomainAnno = tcCompos[1 + (tcCompos.length === 3 ? 1 : 0)];

  if (codomainAnno.search(new RegExp("^[A-Z][A-Za-z0-9]*<.*>$", "")) === NOT_FOUND)
    throw new TypeError(cat(
      "invalid type class declaration\n",
      "type constructor parameterized by a single type parameter\n",
      "expected in the codomain\n",
      `but "${codomainAnno}" received\n`,
      `while declaring "${tcAnno}"\n`));

  // determine name and arity of the codomain

  const tcons = codomainAnno.replace(/<[^>]+>$/, ""),
    tparam = codomainAnno.match(/<([^>]+)>$/) [1];

  // check for name clashes with existing TCs

  if (tcDict.has(tcons))
    throw new TypeError(cat(
      "illegal type class declaration\n",
      "name collision with another type class found\n",
      `namely: ${tcons}\n`,
      `while declaring "${tcAnno}"\n`));

  // check for name clashes with existing ADTs

  else if (adtDict.has(tcons))
    throw new TypeError(cat(
      "illegal type class declaration\n",
      "name collision with an algebraic data type found\n",
      `namely: ${tcons}\n`,
      `while declaring "${tcAnno}"\n`));

  // check for name clashes with existing native types

  else if (nativeDict.has(tcons))
    throw new TypeError(cat(
      "illegal type class declaration\n",
      "name collision with a native type found\n",
      `namely: ${tcons}\n`,
      `while declaring "${tcAnno}"\n`));

  // check for name clashes with existing type constants

  else if (monoDict.has(tcons))
    throw new TypeError(cat(
      "illegal type class declaration\n",
      "name collision with a type constant found\n",
      `namely: ${tcons}\n`,
      `while declaring "${tcAnno}"\n`));

  // pre-register the type class using a default annotation

  tcDict.set(tcons, {tparam, tcAnno: "Undefined", arity: 1, kind: "(* => *) => Constraint"});

  // remove the optional constraints and parse TC annotation

  let tcAst = tcCompos.length === 3
    ? parseAnno(tcAnno.replace(/^.*? => /, ""))
    : parseAnno(tcAnno);

  // create AST references for convenience

  const domainAst = tcAst.body.body.lambdas[0] [0],
    codomainAst = tcAst.body.body.result;

  /* The type dictionary on the ast level is an `Obj` element optionally wrapped
  in a `Forall`, which depends on the occurrence of higher-rank TVs in the TC
  annotation. We create another reference to abstract form this optionally
  `Forall` element. */

  const tdictAst = domainAst[TAG] === "Forall"
    ? domainAst.body
    : domainAst;

  // get the properies of the current TC type dictionary

  const reservedProps = new Set(tdictAst.props);

  /* The type parameter of the TC is either a type constant or a type constructor
  that is itself parameterized a single type parameter. This information must be
  determined and updated at the type parameter within the AST. */

  /*if (domainAst[TAG] === "Forall")
    codomainAst.body.body[0].body.push(Partial);*/

  /* TCs can have types without higher-rank TVs, but we can at least verify
  that the parameter of the top-level function type is a type dictionray
  containing any number of operations/values. */

  if ((domainAst[TAG] !== "Obj" && domainAst[TAG] !== "Forall")
    || domainAst[TAG] === "Forall" && domainAst.body[TAG] !== "Obj")
      throw new TypeError(cat(
        "invalid type class declaration\n",
        "function type parameter must be a type dictionary\n",
        "containg any number of operations/values\n",
        `but "${tcCompos[0 + tcOffset]}" received\n`,
        `while declaring "${tcAnno}"\n`));

  /* Verify that all rank-1 type variables occur in the codomain of the
  function type:

  (^a, b. {of: (a => m<a>), chain: (m<a> => (a => m<a>) => m<b>)}) => Monad<m>
                     ^              ^             ^        ^                ^

  ({empty: m, append: (m => m => m)}) => Monoid<m>
           ^           ^    ^    ^              ^ */

  // collect all rank-1 TVs in the domain

  const tvsDomain = reduceAst((acc, ast) => {
    if (isTV(ast) && ast.scope === ".") {
      acc.add(ast.name);
      return acc;
    }

    else return acc;
  }, new Set()) (domainAst);

  // collect all rank-1 TVs in the codomain

  const tvsCodomain = reduceAst((acc, ast) => {
    if (isTV(ast) && ast.scope === ".") {
      acc.add(ast.name);
      return acc;
    }

    else return acc;
  }, new Set()) (codomainAst);

  // lookup possbile differences

  tvsDomain.forEach((v, k) => {
    if (!tvsCodomain.has(k))
      throw new TypeError(cat(
        "illegal algebraic data type declaration\n",
        `type parameter "${k}" only occurs on the RHS\n`,
        "existential types are not yet supported\n",
        `while declaring "${tcAnno}"\n`));
  });

  // extend current type dictionary by operations/values of its constraints

  constraints.forEach(({tcons: tcons_, tparamFrom, tparamTo, tcAnno: tcAnno_}) => {
    
    // parse the TC annotation of the constraint

    let tcAst_ = parseAnno(tcAnno_);

    /* If the type parameter name of the current TC and its constraint differ,
    it is adjusted by alpha renaming. */

    if (tparamFrom !== tparamTo) {

      // adjust type parameter name

      tcAst_.body.body.lambdas[0] [0] = mapAst(ast => {
        if (ast[TAG] === "BoundTV"
          && ast.scope === "."
          && ast.name === tparamFrom) {
            ast.name = tparamTo;
            return ast;
        }

        else if (ast[TAG] === "Forall"
          && ast.scope === "."
          && ast.btvs.has(tparamFrom)) {
            ast.btvs.delete(tparamFrom);
            ast.btvs.add(tparamTo);
            return ast;
        }

        else return ast;
      }) (tcAst_.body.body.lambdas[0] [0]);
    }

    // create AST reference for convenience
    
    const domainAst_ = tcAst_.body.body.lambdas[0] [0];

    const tdictAst_ = domainAst_[TAG] === "Forall"
      ? domainAst_.body
      : domainAst_;

    // add operations/values

    let btvs = new Set();

    tdictAst_.body.forEach(({k, v}) => {

      // rule out operation/value name collision

      if (reservedProps.has(k))
        throw new TypeError(cat(
          "illegal type class declaration\n",
          "subclass tries to override a property of one of its superclasses\n",
          `namely: ${k}\n`,
          `while declaring "${tcAnno}"\n`));

      // collect rank-2 bound TVs

      btvs = reduceAst((acc, ast) => {
        if (ast[TAG] === "BoundTV"
          && getRank(ast.scope) === 2) {
            return acc.add(ast.name)
        }

        else return acc;
      }, btvs) (v);

      // add operations/values to current type dictionary

      tdictAst.body.push({k, v});
      tdictAst.props.push(k);
    });

    // add an optional quantifier

    if (btvs.size > 0) {
      if (domainAst[TAG] === "Forall")
        domainAst.btvs = new Set([...domainAst.btvs, ...btvs]);

      else
        tcAst.body.body.lambdas[0] [0] = Forall(
          btvs,
          ".0/0.",
          domainAst);
    }
  });

  /* Register the type class using a default annotation. Since scriptum doesn't
  support multi-parameter TCs for the time being, we can just set arity and kind
  to its default values. */

  tcDict.set(tcons, {
    tparam,
    tcAnno: serializeAst(tcAst),
    arity: 1,
    kind: "(* => *) => Constraint"});

  /**************
   * TYPE CLASS *
   **************/

  /* Return a function that excepts zero, one or several super dictionaries
  and unifies the operations of the current type dictionary and the super
  optional dictionaries with these of the resolved type class:
  `{specialicedTypeDict} => {unifiedTypedDict}` */

  const r = (...dicts) => Object.assign(dict => {
    let tvid = 0,
      instantiations = new Map(),
      intros = [],
      aliases = new Map();
    
    // clone the main object

    dict = Object.assign({}, dict);

    // add constraining dictionaries

    dicts.forEach((dict_, i) => {

      // ensure type dictionary arguments

      if (dict_[ADT] === undefined
        && introspectFlat(dict_) !== "Object")
          throw new TypeError(cat(
            "illegal type class instance\n",
            "expect type class arguments as constraints\n",
            `but "${introspectDeep({charCode: letterA}) (dict_)}" received\n`,
            `while applying "${tcAnno}"\n`));

      else {
        Object.entries(dict_).forEach(([k, v]) => {

          // skip identical properties from different superclasses

          if (k in dict) return null;

          // skip symbolic properties

          else if (k === ANNO || k === ADT || k === TAG) return null;
  
          // add property to new type class

          else dict[k] = v;
        });
      }

      /* Make each super dictionary available via a non-enumerable property
      of the current type dictionary. */

      Object.defineProperty(
        dict,
        dict_[TAG],
        {value: dict_, configurable: true, writable: true});
    });

    // dequantify TC AST considering TV introductions

    let intro;

    ({ast: tcAst, intro} = specializeLHS(new Map(), ".") (tcAst));

    if (intro.size > 0) intros.push(intro);

    // collect type level properties without losing rank-2 qunatifiers

    let typeLevelProps;

    if (tcAst.body.body.lambdas[0] [0] [TAG] === "Forall") {
      typeLevelProps = tcAst.body.body.lambdas[0] [0].body.body
        .reduce((acc, {k, v}) => {
          const forall = Object.assign(
            {}, tcAst.body.body.lambdas[0] [0]); // clone `Forall`

          forall.body = v[TAG] === "Forall"
            ? v.body : v;

          return acc.set(k, forall);
        }, new Map());
    }

    else {
      typeLevelProps = tcAst.body.body.lambdas[0] [0].body
        .reduce((acc, {k, v}) => acc.set(k, v), new Map())
    }

    // retrieve term level properties

    const termLevelProps_ = Object.keys(dict),
      termLevelProps = new Set(termLevelProps_);;

    // ensure the property number at type and term level match

    if (typeLevelProps.size !== termLevelProps.size)
      throw new TypeError(cat(
        "illegal type class instance\n",
        "exhaustiveness check failed\n",
        `expected: ${tdictAst.props.join(", ")}\n`,
        `received: ${termLevelProps_.join(", ")}\n`,
        `while applying "${tcAnno}"\n`));

    // traverse term level properties and unify them with the type level

    termLevelProps.forEach(k => {

      // exhaustiveness check

      if (!typeLevelProps.has(k))
        throw new TypeError(cat(
          "illegal type class instance\n",
          "exhaustiveness check failed\n",
          `expected: ${tdictAst.props.join(", ")}\n`,
          `received: ${termLevelProps_.join(", ")}\n`,
          `while applying "${tcAnno}"\n`));

      // type the current function property

      ({tvid, instantiations, aliases, intros} = unifyTypes(
        typeLevelProps.get(k),
        typeof dict[k] === "function"
          ? parseAnno(dict[k] [ANNO])
          : parseAnno(introspectDeep({charCode: letterA}) (dict[k])),
        0,
        0,
        {tvid, instantiations, aliases, intros},
        serializeAst(typeLevelProps.get(k)),
        dict[k] [ANNO],
        tcAnno,
        []));
    });

    /* Update the TC annotation using substitution without removing the type
    parameter. */

    let unifiedAst = prettyPrint(
      recreateAst(
        substitute(
          tcAst,
          instantiations)));

    // collect unified type level properties without losing rank-2 qunatifiers

    let typeLevelProps_;

    if (unifiedAst.body.body.lambdas[0] [0] [TAG] === "Forall") {
      typeLevelProps_ = unifiedAst.body.body.lambdas[0] [0].body.body
        .reduce((acc, {k, v}) => {
          const forall = Object.assign(
            {}, unifiedAst.body.body.lambdas[0] [0]); // clone `Forall`

          forall.body = v[TAG] === "Forall"
            ? v.body : v;

          return acc.set(k, forall);
        }, new Map());
    }

    else {
      typeLevelProps_ = unifiedAst.body.body.lambdas[0] [0].body
        .reduce((acc, {k, v}) => acc.set(k, v), new Map())
    }

    /* Annotate properties of the term level type dictionary using the
    corresponing portions unified TC annotation. */

    termLevelProps.forEach(k => {
      if (typeof dict[k] === "function")
        dict[k] [ANNO] = serializeAst(typeLevelProps_.get(k));
    });

    dict[ADT] = serializeAst(unifiedAst.body.body.result);
    dict[TAG] = tcons;
    return dict;
  }, {[ANNO]: tcAnno});

  // provide no constraining type dictionaries if the type level says so

  return tcCompos.length === 2
    ? r() : r;
};


/******************************************************************************
*******************************************************************************
******************************[ TYPE VALIDATION ]******************************
*******************************************************************************
******************************************************************************/


/* `fun` is one of the major operations of the type validator API. It only
conducts type validation of applications, not definition. It only attempts to
unify the formal parameter of a function type with a provided argument type,
but it does not infer types from given terms. */

export const fun = (f, funAnno) => {
  const go = (g, lamIndex, funAst, funAnno) => {
    const getArgs = (...args) => {

      // create unique numbers for alpha renaming

      let tvid = 0;

      /* Unification generates instantiations, which are later applied to type
      annotations using substitution. Instantiations are mappings from TV to
      TV/Type, where Type is a composite type that might include other TVs. The
      LHS of the mapping might be instantiated with several TVs/Types, which
      all have to unify with one another. `instantiations` is a data structure
      of following form:

      Map("foo" => Map("Bar<baz, bat>" => {keyAst, valueAst, substitutor}))
            |                |                           |
      ^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      key/source type  value/target type            object type

      It maps a key/source type to a value/target type. The keys of both the
      outer and inner maps are used to guarnatee unique mappings. The resulting
      object contains all the information necessary for substituting from the
      key/source to the value/target type. The key/source type has to be a type
      variable, because only type variables can be instantiated. */

      let instantiations = new Map();

      /* We must keep track of type aliases to be able to implement reliable
      occurs and escape checks:

      given:
      a ~ b
      a ~ c

      aliases due to commutativity and transitivity of type equality:
      b ~ a
      c ~ a
      b ~ c
      c ~ b */

      let aliases = new Map(); // Map("key" => Map("key ~ value", [key, value]))

      /* We must keep track which type variables are introduced in which
      subsumption judgement to decide if higher-rank type variables may be
      instantiated with such of lower rank.

      subsumption judgement:
      {left: (a => s), right: (b => s)} => s <: (^r. {left: (a0 => r), right: (b0 => r)} => r)

      introduced type variables:
      [a, b, s, r]

      type aliases:
      a ~ a0
      b ~ b0

      remove type aliases:
      [s, r]

      The rank-2 type variable `r` must only be instantiated with the rank-1
      type variable `s` */

      let intros = []; // [Map("a0" => a0, "b0" => b0), Map("a1" => a1, "b1" => b1, "r1" => r1)]

      // take variadic arguments into account

      switch (funAst.body.body.lambdas[0] [TAG]) {
        case "Argv": {
          args = [args];
          break;
        }

        case "Argsv": {
          args = args
            .slice(0, funAst.body.body.lambdas[0].length - 1)
            .concat([args.slice(funAst.body.body.lambdas[0].length - 1)]);

          break;
        }
      }

      /* Recursively introspect the argument type. Since `introspectDeep` is
      stateful in its `charCode` argument, a reference of the partially applied
      function must be kept for successive use. */

      const introspectDeep_ = introspectDeep({charCode: letterA}),
        argAnnos = args.map(arg => introspectDeep_(arg));

      // parse main function annotation

      const argAsts = argAnnos.map(parseAnno);

      // check function arity (multi-argument/variadic functions are supported)

      if (funAst.body.body.lambdas[0].length !== args.length) {
        if (funAst.body.body.lambdas[0] [TAG] === "Argv"
          || funAst.body.body.lambdas[0] [TAG] === "Argsv")
            throw new TypeError(cat(
              "arity mismatch\n",
              `expected: at least ${funAst.body.body.lambdas[0].length - 1} argument(s)\n`,
              `received: ${args.length - 1} argument(s)\n`,
              extendErrMsg(lamIndex, null, funAnno, argAnnos, instantiations)));
        
        else throw new TypeError(cat(
          "arity mismatch\n",
          `expected: ${funAst.body.body.lambdas[0].length} argument(s)\n`,
          `received: ${args.length} argument(s)\n`,
          extendErrMsg(lamIndex, null, funAnno, argAnnos, instantiations)));
      }

      /* Prior to unification the function type has to be dequantified. During
      this process bound TVs are instantiated with fresh meta TVs. As opposed to
      subsequent dequantifications there is no alpha renaming taking place. This
      ensures that the unified annotation only deviates as little as possible
      from the original user-defined one. */
      
      let intro;

      ({ast: funAst, intro} = specializeLHS(new Map(), funAst.scope) (funAst));

      if (intro.size > 0) intros.push(intro);

      /* Attempt to type validate the application of `fun` with `arg` by
      unifying `fun`'s first formal parameter with `arg`. Since this is a
      higher-rank type validator, subsumption is necessary in order to unify
      deeply nested quantifiers. The subsumption judgement for type application
      reads `arg <: param`, where `<:` denotes the is-at-least-as-polymorphic-as
      relation. The judgement order flips for each nested function argument due
      to the usual co- and contravariant phenomena of the function type. */

      ({tvid, instantiations, aliases, intros} = argAnnos.reduce(
        (acc, argAnno, argIndex) =>
          unifyTypes(
            funAst.body.body.lambdas[0] [TAG] === "Arg0"
              ? Tconst("Undefined")
              : funAst.body.body.lambdas[0] [argIndex],
            parseAnno(argAnno),
            lamIndex,
            argIndex,
            {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
            funAst.body.body.lambdas[0] [TAG] === "Arg0"
              ? "Undefined"
              : serializeAst(funAst.body.body.lambdas[0] [argIndex]),
            argAnno,
            funAnno,
            argAnnos), {tvid, instantiations, aliases, intros}));

      // disclose transitive relations

      ({tvid, instantiations, aliases, intros} = uncoverTransRel(
        {tvid, instantiations, aliases, intros}, lamIndex, null, funAnno, argAnnos));

      // remove interfering type aliases

      instantiations = remConflictingAliases(instantiations);

      // conduct occurs check

      instantiations.forEach(m => {
        m.forEach(({key: keyAst, value: valueAst}) =>
          occursCheck(keyAst, valueAst, instantiations, aliases, new Set(), lamIndex, null, funAnno, argAnnos));
      });

      /* After unification of the application the consumed type parameter must
      be removed from the AST and all instantiations must be substituted within
      the remaining subtree. Since the extracted subtree can include redundant
      `Forall` elements the entire subtree must be recreated. The type
      parameter(s) is/are removed before the substitution, because this spares
      some work. There might be several parameters due to scriptum's support of
      multi argument functions. */

      let unifiedAst = prettyPrint(
        recreateAst(
          substitute(
            remParams(funAst),
            instantiations)));

      // take variadic arguments into account

      switch (funAst.body.body.lambdas[0] [TAG]) {
        case "Argv": {
          args = args[0];
          break;
        }

        case "Argsv": {
          args = args.slice(0, -1).concat(args[args.length - 1]);
          break;
        }
      }

      // actually apply `fun` with `arg` on the term level

      let r = g(...args);

      // rule out `undefined` as return value

      if (r === undefined)
        throw new TypeError(cat(
          `illegal "undefined" result type\n`,
          "after applying the given function term to its argument(s)\n",
          `runtime immediately terminated\n`,
          extendErrMsg(lamIndex, null, funAnno, argAnnos, instantiations)));

      /* If the result value is a function the type validator cannot determine
      its type, because functions are opaque values. However, if the unified
      type is also a function type we can assume at this point that both types
      match. */

      else if (introspectFlat(r) === "Function") {

          // check whether the unified type is a function type as well

          if (unifiedAst[TAG] === "Forall"
            && unifiedAst.body[TAG] === "Fun")
              return go(r, lamIndex + 1, unifiedAst, serializeAst(unifiedAst));

          else
            throw new TypeError(cat(
              `result type mismatch in parameter #${lamIndex + 1}\n`,
              `expected: ${serializeAst(unifiedAst)}\n`,
              `received: ${introspectFlat(r)}\n`,
              extendErrMsg(lamIndex, null, funAnno, argAnnos, instantiations)));
      }

      // check whether the result is an ADT or TC

      else if (r && r[ADT]) {

        const tcons = r[ADT].match(new RegExp("^[A-Z][a-zA-Z0-9]*", "")) [0];

        // check whether the result is an ADT
        
        if (adtDict.has(tcons)) {
          
          // parse domain and codomain

          let domainAst = r.run[ANNO]
            ? parseAnno(r.run[ANNO])
            : parseAnno(introspectDeep_(r));
          
          let codomainAst = parseAnno(r[ADT]);

          // dequantify ADT AST considering TV introductions

          let intro;

          ({ast: unifiedAst, intro} = specializeLHS(new Map(), ".") (unifiedAst));

          if (intro.size > 0) intros.push(intro);

          // unify the function type application

          ({tvid, instantiations, aliases, intros} = unifyTypes(
            unifiedAst,
            codomainAst,
            0,
            0,
            {tvid, instantiations, aliases, intros},
            serializeAst(unifiedAst),
            r[ADT],
            funAnno,
            argAnnos));

          // disclose transitive relations

          ({tvid, instantiations, aliases, intros} = uncoverTransRel(
            {tvid, instantiations, aliases, intros}, null, null, funAnno, argAnnos));

          // remove contradictory instantiations

          instantiations = remConflictingAliases(instantiations);

          // conduct occurs check

          instantiations.forEach(m => {
            m.forEach(({key: keyAst, value: valueAst}) =>
              occursCheck(keyAst, valueAst, instantiations, aliases, new Set(), null, null, funAnno, argAnnos));
          });

          // dequantify domain/codomain

          ({ast: domainAst} = specializeLHS(new Map(), ".", 1) (domainAst));
          ({ast: codomainAst} = specializeLHS(new Map(), ".", 1) (codomainAst));

          // adjust domain according to the unified type using subsumption

          const domainAnno = serializeAst(
            prettyPrint(
              recreateAst(
                substitute(
                  domainAst,
                  instantiations))));

          // adjust codomain according to the unified type using subsumption

          const codomainAnno = serializeAst(
            prettyPrint(
              recreateAst(
                substitute(
                  codomainAst,
                  instantiations))));

          // update the ADT annotations

          if (r.run[ANNO])
            r.run[ANNO] = domainAnno;
          
          r[ADT] = codomainAnno;

          return r;
        }

        // no special treatment for TCs

        else if (tcDict.has(tcons))
          return r;

        else
          throw TypeError("internal error: ADT or TC expected");
      }

      // unify the unified type with the actual term level result

      else {
        
        // introspect the value yielded at the term level

        const resultAnno = introspectDeep_(r);

        // dequantify the unified AST prior to unification

        ({ast: unifiedAst} = specializeLHS(new Map(), unifiedAst.scope) (unifiedAst));

        /* Attempt to unify type and term level to prove that the yielded value
        at the term level has the expected type, hence this unification process
        is completely decoupled from previous turns and possible new
        instantiations, aliases and introductions are discarded. */

        unifyTypes(
          unifiedAst,
          parseAnno(resultAnno),
          0,
          0,
          {tvid: 0, instantiations: new Map(), aliases: new Map(), intros: []},
          serializeAst(funAst.body.body.result),
          resultAnno,
          funAnno,
          argAnnos);

        return r;
      }
    };

    // attach current type annotation to term level function object

    getArgs[ANNO] = serializeAst(funAst);
    
    // return the typed function that awaits further arguments

    return getArgs;
  };

  /********************
   * MAIN ENTRY POINT *
   ********************/

  // bypass type validator

  if (CHECK === false) return f;

  // throw an error on untyped function

  else if (funAnno === undefined)
    throw new TypeError(cat(
      "missing type annotation\n",
      "scriptum only allows type annotated lambdas\n",
      "but an untyped lambda received\n"));

  // run the validator

  else {

    /* scriptum supports indentations and newlines to render type annotations
    more readable. These optional characters must be removed before type
    validation. */

    funAnno = funAnno.replace(new RegExp("[ \\t]*\\r\\n[ \\t]*|[ \\t]*\\n[ \\t]*", "g"), "")
      .replace(new RegExp(SAFE_SPACE, "g"), " ");

    /* The `fun` operation can only type lambdas, i.e. the top-level type must
    be a function type. */

    if (remNestings(remQuant(funAnno)).search(/ => /) === NOT_FOUND)
      throw new TypeError(cat(
        "top-level type must be a function\n",
        `but ${funAnno} received\n`));

    else {

      // parse the main function annotation

      const funAst = parseAnno(funAnno);

      // return the typed function

      return go(f, 0, funAst, funAnno);
    }
  }
};


/* Check for all instantiations of the form `TV => TV` whether there are
interfering mappings like

a => b1
b1 => a

and delete mappings from older to newer entries. */

const remConflictingAliases = instantiations => {
  instantiations.forEach(m => {
    const xs = Array.from(m);

    for (let i = 0; i < xs.length; i++) {
      const [, {key, value}] = xs[i];

      if (isTV(value)
        && instantiations.has(value.name)) {
          if (instantiations.get(value.name).has(`${value.name} ~ ${key.name}`)) {
            instantiations.get(value.name).delete(`${value.name} ~ ${key.name}`);

            if (instantiations.get(value.name).size === 0)
              instantiations.delete(value.name);
          }
      }
    }
  });

  return instantiations;
};


/* A TV or one of its type aliases on the LHS of an instantiation must not
occur within a composite type on the RHS, because this would introduce an
infinite definition. Infinite types lead to non-termination during
substitution and thus must be rejected by the type validator. */

const occursCheck = (keyAst, valueAst, instantiations, aliases, history, lamIndex, argIndex, funAnno, argAnnos) => {

  // return early if valueAst isn't a composite type

  if (!isTV(valueAst)
    && valueAst[TAG] !== "RowVar"
    && valueAst[TAG] !== "Tconst") {

      // throw an error if keyAst occurs in valueAst

      mapAst(ast => {
        if (isTV(ast)
          && ast.name === keyAst.name) {
            if (aliases.has(keyAst.name))
              throw new TypeError(cat(
                "occurs check failed\n",
                `"${keyAst.name}" or one of its aliases\n`,
                "occurs on the LHS and RHS of the type annotation\n",
                "cannot construct the resulting infinite type\n",
                extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));

            else
              throw new TypeError(cat(
                "occurs check failed\n",
                `"${keyAst.name}" occurs on the LHS and RHS of the type annotation\n`,
                "cannot construct the resulting infinite type\n",
                extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));
        }
        
        else return ast;
      }) (valueAst);

      // check alias occurrences if any

      if (aliases.has(keyAst.name)
        && !history.has(keyAst.name)) {
      
        // recursively check whether one of its aliases occurs in valueAst
        
        aliases.get(keyAst.name).forEach(([, aliasAst]) =>
          occursCheck(aliasAst, valueAst, instantiations, aliases, history.add(aliasAst.name), lamIndex, argIndex, funAnno, argAnnos));
      }
  }
};


/* Disclose transitive relations between TVs:

a ~ b
a ~ c

yields the type equality by transitivity

b ~ c */

const uncoverTransRel = ({tvid, instantiations, aliases, intros}, lamIndex, argIndex, funAnno, argAnnos) => {
  instantiations.forEach((m, keyAnno) => {
    const xs = Array.from(m);

    if (xs.length > 1) {
      for (let i = 1; i < xs.length; i++) {
        const [, {value: valueAst}] = xs[i];

        ({tvid, instantiations, aliases, intros} = unifyTypes(
          xs[0] [1].value,
          valueAst,
          lamIndex,
          argIndex,
          {tvid, instantiations, aliases, intros},
          keyAnno,
          serializeAst(valueAst),
          funAnno,
          argAnnos));
      }
    }
  });

  return {tvid, instantiations, aliases, intros};
};


/******************************************************************************
**************************[ UNIFICATION/SUBSUMPTION ]**************************
******************************************************************************/


const unifyTypes = (paramAst, argAst, lamIndex, argIndex, state, paramAnno, argAnno, funAnno, argAnnos) => {

  /* In order to determine if a function application `f(x)` is well typed in a
  language with higher-order functions and higher-rank types we must determine
  whether the type of `x` is a subtype of `f`'s type parameter, i.e. can safely
  be used in a context where the type of `f`'s' parameter is expected. Please
  note that in functional programming instead of "is a subtype of" we rather
  use the term "is at least as polymorphic as" relating to parametricity.

  Higher-rank types or impredicative types are only valid on the LHS of the
  function type. The function type is contravariant in its argument type and
  covariant in its result type. Contravariance flips the order of types whereas
  covariance maintains it.

  First-order:

  A => B <: C => D if
  B <: D (covariance)
  C <: A (contravariance)

  Higher-order:

  (A => B) => C <: (D => E) => F if
  C <: F (covariance)
  D => E <: A => B (contravariance) if
  E <: B
  A <: D

  The "<:" symbol denotes the "is a subtype of"/"is at least as polymorphic as"
  relation. For nested function types the variance rules must be applied several
  times leading to a somewhat confusing distribution of contra- and covariance.
  The less formal subsumption rule of function application reads as follows:

  The function application `f(x)` is type safe if `x <: p` holds.

  In the above judgement `x` is an argument type and `p` is `f`'s type parameter. */

  // destructure state

  let {tvid, instantiations, aliases, intros} = state;

  /* In order to conduct an escape check we need to determine which meta TVs a
  rigid TV is allowed to be instantiated with. All meta TVs that are introduced
  within the same subsumption judgement and that are not aliases of TVs of
  earlier introductions are legit instantiations. */

  let intro = new Map();

  /* Higher-rank TVs only exist in their scope and must not escape it. As the
  caller of a higher-rank function type you cannot pick a specific type for its
  higher-rank TVs and you cannot use this TVs outside the function's scope.
  The unification algorithm used in scriptum distinguish between meta and rigid
  TVs to address these issues. A rigid TV denotes a higher-rank one, which was
  located on the RHS of the subsumption judgement during instantiation. */

  if (argAst[TAG] === "Forall" && argAst.btvs.size > 0)
    ({ast: argAst, intro} = specializeLHS(intro, argAst.scope, ++tvid) (argAst));

  if (paramAst[TAG] === "Forall" && paramAst.btvs.size > 0)
    ({ast: paramAst, intro} = specializeRHS(intro, paramAst.scope, ++tvid) (paramAst));

  // make TV introduction persitent across function calls

  if (intro.size > 0) intros.push(intro);

  /* TVs can represent higher-kinded types, therefore their arity must be
  unified as well. If we assume that type constructors are generative and
  injective, the following instantiation rules apply:
  
  ~ = type equality
  !~ = type inequality

  f<a> ~ g<b, c, d>
  f<a, b, c> ~ g<d>
  F<a> !~ g<b, c, d>
  F<a, b, c> ~ g<d>
  f<a> ~ G<b, c, d>
  f<a, b, c> !~ G<d>
  F<a> !~ G<b, c, d>
  F<a, b, c> !~ G<d> */

  // the mother of all conditionals

  switch (paramAst[TAG]) {
    case "Adt": {
      switch (argAst[TAG]) {
        case "Adt": {// Adt<a, b> ~ Adt<c, d>
          if (paramAst.cons !== argAst.cons) {
            throw new TypeError(cat(
              "type constructor mismatch\n",
              `expected: ${paramAst.cons}\n`,
              `received: ${argAst.cons}\n`,
              "while unifying\n",
              `${paramAnno}\n`,
              `${argAnno}\n`,
              extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));
          }

          else {
            return paramAst.body.reduce((acc, field, i) =>
              unifyTypes(
                field,
                argAst.body[i],
                lamIndex,
                argIndex,
                {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos), {tvid, instantiations, aliases, intros});
          }
        }

        case "BoundTV": // Adt<a, b> ~ bound c
          throw new TypeError(
            "internal error: unexpected bound type variable");

        case "Forall": // Adt<a, b> ~ forall
          return unifyTypes(
            paramAst,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);

        case "MetaTV":
        case "RigidTV": {// Adt<a, b> ~ u<c> | u<c, d>
          if (argAst.body.length === 0) { // Adt<a, b> ~ c
            ({instantiations, aliases} = instantiate(
              argAst,
              paramAst,
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? toAst
                  : refAst,
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          else if (argAst.body.length <= paramAst.body.length) { // Adt<a, b> ~ u<c> | u<c, d>
            ({instantiations, aliases} = instantiate( // Adt | Adt<a> ~ u
              (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                argAst.name,
                argAst.scope,
                argAst.position,
                Array(argAst.body.length).fill(Partial)),
              paramAst.body.length === argAst.body.length
                ? Adt(paramAst.cons, Array(paramAst.body.length).fill(Partial))
                : Adt(
                    paramAst.cons,
                    paramAst.body.slice(0, paramAst.body.length - argAst.body.length)
                      .concat(Array(argAst.body.length).fill(Partial))),
              (refAst, fromAst, toAst) => {
                if (refAst[TAG] === fromAst[TAG]
                  && refAst.name === fromAst.name)
                    return refAst.body.length === toAst.body.length
                      ? Adt(toAst.cons, refAst.body)
                      : Adt(
                          toAst.cons,
                          toAst.body.slice(0, toAst.body.length - refAst.body.length)
                            .concat(refAst.body));

                else return refAst
              },
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return paramAst.body.slice(paramAst.body.length - argAst.body.length).reduce((acc, field, i) =>
              unifyTypes(
                field,
                argAst.body[i],
                lamIndex,
                argIndex,
                {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos), {tvid, instantiations, aliases, intros});
          }

          else // Adt<a, b> ~ u<c, d, e>
            unificationError(
              serializeAst(paramAst),
              serializeAst(argAst),
              lamIndex,
              argIndex,
              instantiations,
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
        }

        case "Partial": { // Adt<a, b> ~ __
          ({instantiations, aliases} = instantiate(
            argAst,
            paramAst,
            (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
              && refAst.name === fromAst.name
                ? toAst
                : refAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos));

          return {tvid, instantiations, aliases, intros};
        }

        default: // Adt<a, b> ~ composite type except Adt<a, b>
          unificationError(
            serializeAst(paramAst),
            serializeAst(argAst),
            lamIndex,
            argIndex,
            instantiations,
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }
    }

    case "Arr": {
      switch (argAst[TAG]) {
        case "Arr": // [a] ~ [b]
          return unifyTypes(
            paramAst.body,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);

        case "BoundTV": // [a] ~ bound b
          throw new TypeError(
            "internal error: unexpected bound type variable");

        case "Forall": // [a] ~ forall
          return unifyTypes(
            paramAst,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
        
        case "MetaTV":
        case "RigidTV": {
          if (argAst.body.length === 0) { // [a] ~ b
            ({instantiations, aliases} = instantiate(
                argAst,
                paramAst,
                (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                  && refAst.name === fromAst.name
                    ? toAst
                    : refAst,
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          else if (argAst.body.length === 1) { // [a] ~ u<b>
            ({instantiations, aliases} = instantiate( // u ~ []
              (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                argAst.name,
                argAst.scope,
                argAst.position,
                [Partial]),
              Arr(Partial),
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? Arr(refAst.body[0])
                  : refAst,
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return unifyTypes(
              paramAst.body,
              argAst.body[0],
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
          }

          else // [a] ~ u<b, c>
            unificationError(
              serializeAst(paramAst),
              serializeAst(argAst),
              lamIndex,
              argIndex,
              instantiations,
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
        }

        case "Partial": { // [a] ~ __
          ({instantiations, aliases} = instantiate(
            argAst,
            paramAst,
            (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
              && refAst.name === fromAst.name
                ? toAst
                : refAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos));

          return {tvid, instantiations, aliases, intros};
        }

        default: // [a] ~ composite type except [b]
          unificationError(
            serializeAst(paramAst),
            serializeAst(argAst),
            lamIndex,
            argIndex,
            instantiations,
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }
    }

    case "BoundTV":
      throw new TypeError(
        "internal error: unexpected bound type variable");

    case "Forall": {
      switch (argAst[TAG]) {
        case "Forall": // forall ~ forall
          return unifyTypes(
            paramAst.body,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);

        default: // forall ~ any type except forall
          return unifyTypes(
            paramAst.body,
            argAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }      
    }

    case "Fun": {
      switch (argAst[TAG]) {
        case "BoundTV": // (a => b) ~ bound c
          throw new TypeError(
            "internal error: unexpected bound type variable");

        case "Forall": // (a => b) ~ forall
          return unifyTypes(
            paramAst,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);

        case "Fun": { // (a => b) ~ (c => d)

          /* The function type is contravariant in its argument and covariant in
          its result type. For the application of function composition with
          itself this means:

          comp :: (b => c) => (a => b) => a => c
          goal: comp(comp)
          
          (b1 => c1) => (a1 => b1) => a1 => c1 <: b => c
          b <: b1 => c1 // contravariant 
          (a1 => b1) => a1 => c1 <: c // covariant

          The result type can either by the remainder of the curried function
          sequence or the final result. */

          // contravariant subsumption

          if (paramAst.body.lambdas[0] [TAG] !== argAst.body.lambdas[0] [TAG]
            || paramAst.body.lambdas[0].length !== argAst.body.lambdas[0].length)
              throw new TypeError(cat(
                "arity mismatch\n",
                "cannot match argument list\n",
                `expected: ("${paramAst.body.lambdas.map(serializeAst).join(", ")}")\n`,
                `received: ("${argAst.body.lambdas.map(serializeAst).join(", ")}")\n`,
                "while unifying\n",
                `${paramAnno}\n`,
                `${argAnno}\n`,
                extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));

          switch (paramAst.body.lambdas[0] [TAG]) {
            case "Arg0": break; // thunk
            
            /* Since the function type is contravariant in its argument type
            the subsumption judgement `arg <: param` is flipped by passing the
            argument AST first and then the parameter one. */

            case "Arg1": // single argument
            case "Argv": { // variadic argument
              ({tvid, instantiations, aliases, intros} = unifyTypes(
                argAst.body.lambdas[0] [0],
                paramAst.body.lambdas[0] [0],
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos));

              break;
            }
            
            /* Since the function type is contravariant in its argument type
            the subsumption judgement `arg <: param` is flipped by passing the
            argument AST first and then the parameter one. */

            case "Args": // multi argument
            case "Argsv": { // multi argument with a trailing variadic argument
              ({tvid, instantiations, aliases, intros} = paramAst.body.lambdas[0].reduce((acc, arg, i) =>
                unifyTypes(
                  argAst.body.lambdas[0] [i],
                  paramAst.body.lambdas[0] [i],
                  lamIndex,
                  argIndex,
                  {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                  paramAnno,
                  argAnno,
                  funAnno,
                  argAnnos), {tvid, instantiations, aliases, intros}));

              break;
            }

            default:
              throw new TypeError(
                "internal error: unknown argument list constructor");
          }

          // covariant subsumption

          if (paramAst.body.lambdas.length === 1) {
            if (argAst.body.lambdas.length === 1) { // (a => b) ~ (c => d)
              return unifyTypes(
                paramAst.body.result,
                argAst.body.result,
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos);
            }

            else { // (a => b) ~ (c => d => e)
              const argAst_ = Fun(
                argAst.body.lambdas.slice(1),
                argAst.body.result);

              return unifyTypes(
                paramAst.body.result,
                argAst_,
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos);
            }
          }

          else {
            if (argAst.body.lambdas.length === 1) { // (a => b => c) ~ (d => e)
              const paramAst_ = Fun(
                paramAst.body.lambdas.slice(1),
                paramAst.body.result);

              return unifyTypes(
                paramAst_,
                argAst.body.result,
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos);
            }

            else { // (a => b => c) ~ (d => e => f)
              const paramAst_ = Fun(
                paramAst.body.lambdas.slice(1),
                paramAst.body.result);

              const argAst_ = Fun(
                argAst.body.lambdas.slice(1),
                argAst.body.result);

              return unifyTypes(
                paramAst_,
                argAst_,
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos);
            }
          }
        }

        case "MetaTV":
        case "RigidTV": { // zyx
          if (argAst.body.length === 0) { // (a => b) ~ c
            ({instantiations, aliases} = instantiate(
              argAst,
              paramAst,
              (refAst, fromAst, toAst) => {
                if (refAst[TAG] === fromAst[TAG]
                  && refAst.name === fromAst.name)
                    return refAst.position === "codomain"
                      ? Codomain(...toAst.body.lambdas, toAst.body.result)
                      : Forall(new Set(), ".", toAst);

                else return refAst;
              },
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          else {
            const arityDiff = retrieveArity(paramAst) - argAst.body.length;

            if (arityDiff === 0) { // (() => b) ~ u<c> | (a => b) ~ u<c, d> | (a, b => c) ~ u<d, e, f>

              // unify domain

              switch (paramAst.body.lambdas[0] [TAG]) {
                case "Arg0": {
                  ({instantiations, aliases} = instantiate( // (=>) ~ u
                    (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                      argAst.name,
                      argAst.scope,
                      argAst.position,
                      [Partial]),
                    Fun([new Arg0()], Partial),
                    (refAst, fromAst, toAst) => {
                      if (refAst[TAG] === fromAst[TAG]
                        && refAst.name === fromAst.name) {
                          return Forall(
                            new Set(),
                            ".",
                            Fun([
                              new Arg0()],
                              mapAst(refAst_ => {
                                if (refAst_[TAG] === "MetaTV" || refAst_[TAG] === "RigidTV")
                                  return (refAst_[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                                    refAst_.name,
                                    refAst_.scope,
                                    "codomain",
                                    refAst_.body);
                                
                                else return refAst_;
                              }) (refAst.body[0])));
                      }
                      
                      else return refAst;
                    },
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos));

                  break;
                }

                case "Arg1": {
                  ({instantiations, aliases} = instantiate( // (=>) ~ u
                    (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                      argAst.name,
                      argAst.scope,
                      argAst.position,
                      [Partial, Partial]),
                    Fun([new Arg1(Partial)], Partial),
                    (refAst, fromAst, toAst) => {
                      if (refAst[TAG] === fromAst[TAG]
                        && refAst.name === fromAst.name) {
                          return Forall(
                            new Set(),
                            ".",
                            Fun([
                              new Arg1(refAst.body[0])],
                              mapAst(refAst_ => {
                                if (refAst_[TAG] === "MetaTV" || refAst_[TAG] === "RigidTV")
                                  return (refAst_[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                                    refAst_.name,
                                    refAst_.scope,
                                    "codomain",
                                    refAst_.body);
                                
                                else return refAst_;
                              }) (refAst.body[1])));
                      }
                      
                      else return refAst;
                    },
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos));

                  ({tvid, instantiations, aliases, intros} = unifyTypes(
                    paramAst.body.lambdas[0] [0],
                    argAst.body[0],
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos));

                  break;
                }

                case "Args": {
                  ({instantiations, aliases} = instantiate( // (=>) ~ u
                    (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                      argAst.name,
                      argAst.scope,
                      argAst.position,
                      Array(argAst.body.length).fill(Partial)),
                    Fun([
                      Args.fromArr(Array(paramAst.body.lambdas[0].length).fill(Partial))],
                      Partial),
                    (refAst, fromAst, toAst) => {
                      if (refAst[TAG] === fromAst[TAG]
                        && refAst.name === fromAst.name) {
                          return Forall(
                            new Set(),
                            ".",
                            Fun([
                              Args.fromArr(refAst.body.slice(0, -1))],
                              mapAst(refAst_ => {
                                if (refAst_[TAG] === "MetaTV" || refAst_[TAG] === "RigidTV")
                                  return (refAst_[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                                    refAst_.name,
                                    refAst_.scope,
                                    "codomain",
                                    refAst_.body);
                                
                                else return refAst_;
                              }) (refAst.body[refAst.body.length - 1])));
                      }
                      
                      else return refAst;
                    },
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos));

                  ({tvid, instantiations, aliases, intros} = paramAst.body.lambdas[0].reduce((acc, ast, i) =>
                    unifyTypes(
                      ast,
                      argAst.body[i],
                      lamIndex,
                      argIndex,
                      {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                      paramAnno,
                      argAnno,
                      funAnno,
                      argAnnos), {tvid, instantiations, aliases, intros}));

                  break;
                }

                default: // Argv/Argsv are excluded
                  unificationError(
                    serializeAst(paramAst),
                    serializeAst(argAst),
                    lamIndex,
                    argIndex,
                    instantiations,
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos);
              }
            }

            else if (arityDiff < 0) // (() => b) ~ u<c, d> | (a => b) ~ u<c, d, e> | (a, b => c) ~ u<d, e, f, g>
              unificationError(
                serializeAst(paramAst),
                serializeAst(argAst),
                lamIndex,
                argIndex,
                instantiations,
                paramAnno,
                argAnno,
                funAnno,
                argAnnos);

            else { // (a => b) ~ u<c> | (a, b => c) ~ u<d, e>

              // unify domain
              
              switch (paramAst.body.lambdas[0] [TAG]) {
                case "Arg0": throw new TypeError(
                  "internal error: unexpected thunk");

                case "Arg1": {
                  ({instantiations, aliases} = instantiate( // (a => ) ~ u
                    (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                      argAst.name,
                      argAst.scope,
                      argAst.position,
                      [Partial]),
                    Fun([paramAst.body.lambdas[0]], Partial),
                    (refAst, fromAst, toAst) => {
                      if (refAst[TAG] === fromAst[TAG]
                        && refAst.name === fromAst.name) {
                          return Forall(
                            new Set(),
                            ".",
                            Fun([
                              toAst.body.lambdas[0]],
                              mapAst(refAst_ => {
                                if (refAst_[TAG] === "MetaTV" || refAst_[TAG] === "RigidTV")
                                  return (refAst_[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                                    refAst_.name,
                                    refAst_.scope,
                                    "codomain",
                                    refAst_.body);
                                
                                else return refAst_;
                              }) (refAst.body[0])));
                      }
                       
                      else return refAst;
                    },
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos));

                  break;
                }

                case "Args": {
                  ({instantiations, aliases} = instantiate( // (a, b =>) ~ u
                    (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                      argAst.name,
                      argAst.scope,
                      argAst.position,
                      Array(argAst.body.length).fill(Partial)),
                    Fun([
                      paramAst.body.lambdas[0]
                        .slice(0, arityDiff)
                        .concat(Array(argAst.body.length - 1).fill(Partial))],
                      Partial),
                    (refAst, fromAst, toAst) => {
                      if (refAst[TAG] === fromAst[TAG]
                        && refAst.name === fromAst.name) {
                          return Forall(
                            new Set(),
                            ".",
                            Fun([
                              toAst.body.lambdas[0]
                                .slice(0, arityDiff)
                                .concat(Args.fromArr(refAst.body.slice(0, -1)))],
                              mapAst(refAst_ => {
                                if (refAst_[TAG] === "MetaTV" || refAst_[TAG] === "RigidTV")
                                  return (refAst_[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                                    refAst_.name,
                                    refAst_.scope,
                                    "codomain",
                                    refAst_.body);
                                
                                else return refAst_;
                              }) (refAst.body[refAst.body.length - 1])));
                      }

                      else return refAst;
                    },
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos));

                  ({tvid, instantiations, aliases, intros} = paramAst.body.lambdas[0]
                    .slice(arityDiff)
                    .reduce((acc, ast, i) =>
                      unifyTypes(
                        ast,
                        argAst.body[i],
                        lamIndex,
                        argIndex,
                        {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                        paramAnno,
                        argAnno,
                        funAnno,
                        argAnnos), {tvid, instantiations, aliases, intros}));

                  break;
                }

                default: // Argv/Argsv are excluded
                  unificationError(
                    serializeAst(paramAst),
                    serializeAst(argAst),
                    lamIndex,
                    argIndex,
                    instantiations,
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos);
              }
            }

            // unify codomain

            if (paramAst.body.lambdas.length === 1) {
              return unifyTypes(
                paramAst.body.result,
                argAst.body[argAst.body.length - 1],
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos);
            }

            else {
              const paramAst_ = Fun(
                paramAst.body.lambdas.slice(1),
                paramAst.body.result);

              return unifyTypes(
                paramAst_,
                argAst.body[argAst.body.length - 1],
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos);
            }
          }
        }

        case "Partial": { // (a => b) ~ __
          ({instantiations, aliases} = instantiate(
            argAst,
            paramAst,
            (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
              && refAst.name === fromAst.name
                ? toAst
                : refAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos));

          return {tvid, instantiations, aliases, intros};
        }

        default: // (a => b) ~ composite type except (c => d)
          unificationError(
            serializeAst(paramAst),
            serializeAst(argAst),
            lamIndex,
            argIndex,
            instantiations,
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }
    }

    case "MetaTV":
    case "RigidTV": {
      switch (argAst[TAG]) {
        case "BoundTV": // a ~ bound b
          throw new TypeError(
            "internal error: unexpected bound type variable");

        case "Forall":
          return unifyTypes(
            paramAst,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);

        case "MetaTV":
        case "RigidTV": { // xyz

          /* Generic type constructors can abstract over arity, hence the latter
          has to be taken into account. */

          if (paramAst.body.length === 0 && argAst.body.length === 0) { // a ~ b
            if (paramAst.name === argAst.name) // a ~ a
              return {tvid, instantiations, aliases, intros};

            else {
              ({instantiations, aliases} = instantiate( // a ~ b
                paramAst,
                argAst,
                (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                  && refAst.name === fromAst.name
                    ? toAst
                    : refAst,
                  lamIndex,
                  argIndex,
                  {tvid, instantiations, aliases, intros},
                  paramAnno,
                  argAnno,
                  funAnno,
                  argAnnos));

              return {tvid, instantiations, aliases, intros};
            }
          }

          else if (paramAst.body.length === 0) { // a ~ u<b>
            ({instantiations, aliases} = instantiate(
              paramAst,
              argAst,
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? toAst
                  : refAst,
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          else if (argAst.body.length === 0) { // t<a> ~ b
            ({instantiations, aliases} = instantiate(
              argAst,
              paramAst,
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? toAst
                  : refAst,
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          const arityDiff = paramAst.body.length - argAst.body.length;
          
          if (arityDiff === 0) { // t<a, b> ~ u<c, d>
            if (paramAst.name === argAst.name) { // t ~ t
              // noop
            }

            else { // t ~ u
              ({instantiations, aliases} = instantiate(
                (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                  paramAst.name,
                  paramAst.scope,
                  paramAst.position,
                  Array(paramAst.body.length).fill(Partial)),
                (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                  argAst.name,
                  argAst.scope,
                  argAst.position,
                  Array(argAst.body.length).fill(Partial)),
                (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                  && refAst.name === fromAst.name
                    ? (toAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                        toAst.name,
                        toAst.scope,
                        toAst.position,
                        refAst.body)
                    : refAst,
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos));
            }

            return paramAst.body.reduce((acc, field, i) =>
              unifyTypes(
                field,
                argAst.body[i],
                lamIndex,
                argIndex,
                {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos), {tvid, instantiations, aliases, intros});
          }
          
          else if (arityDiff < 0) { // t<a, b> ~ u<c, d, e, f>
            const fields = argAst.body.slice(arityDiff);

            ({instantiations, aliases} = instantiate( // t ~ u<c, d>
              (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                paramAst.name,
                paramAst.scope,
                paramAst.position,
                Array(paramAst.body.length).fill(Partial)),
              (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                argAst.name,
                argAst.scope,
                argAst.position,
                argAst.body.slice(0, argAst.body.length - paramAst.body.length)
                  .concat(Array(paramAst.body.length).fill(Partial))),
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? (toAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                      toAst.name,
                      toAst.scope,
                      toAst.position,
                      refAst.body.slice(arityDiff))
                  : refAst,
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return fields.reduce((acc, field, i) =>
              unifyTypes(
                paramAst.body[i],
                field,
                lamIndex,
                argIndex,
                {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos), {tvid, instantiations, aliases, intros});
          }

          else if (arityDiff > 0) { // t<a, b, c, d> ~ u<e, f>
            unificationError(
              serializeAst(paramAst),
              serializeAst(argAst),
              lamIndex,
              argIndex,
              instantiations,
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
          }
        }

        case "Partial": { // a | t<a> ~ __
          ({instantiations, aliases} = instantiate(
            argAst,
            paramAst,
            (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
              && refAst.name === fromAst.name
                ? toAst
                : refAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos));

          return {tvid, instantiations, aliases, intros};
        }

        default: { // xyz
          if (paramAst.body.length === 0) { // a ~ composite type
            if (argAst[TAG] === "Fun") { // a ~ (b => c)
              ({instantiations, aliases} = instantiate(
                paramAst,
                argAst,
                (refAst, fromAst, toAst) => {
                  if (refAst[TAG] === fromAst[TAG]
                    && refAst.name === fromAst.name)
                      return refAst.position === "codomain"
                        ? Codomain(...toAst.body.lambdas, toAst.body.result)
                        : Forall(new Set(), ".", toAst);
                  
                  else return refAst;
                },
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos));

              return {tvid, instantiations, aliases, intros};
            }

            else {
              ({instantiations, aliases} = instantiate( // a ~ composite type
                paramAst,
                argAst,
                (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                  && refAst.name === fromAst.name
                    ? toAst
                    : refAst,
                lamIndex,
                argIndex,
                {tvid, instantiations, aliases, intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos));

              return {tvid, instantiations, aliases, intros};
            }
          }

          else {
            const argArity = retrieveArity(argAst);
            
            if (paramAst.body.length > argArity)
              throw new TypeError(cat(
                "type constructor arity mismatch\n",
                `expected: ${serializeAst(paramAst)}\n`,
                `received: ${serializeAst(argAst)}\n`,
                "while unifying\n",
                `${paramAnno}\n`,
                `${argAnno}\n`,
                extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));

            else {
              switch (argAst[TAG]) {
                case "Adt": { // t<a> | t<a, b> ~ Adt<c, d>
                  if (paramAst.body.length === 0) { // a ~ Adt<b, c>
                    ({instantiations, aliases} = instantiate(
                      paramAst,
                      argAst,
                      (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                        && refAst.name === fromAst.name
                          ? toAst
                          : refAst,
                      lamIndex,
                      argIndex,
                      {tvid, instantiations, aliases, intros},
                      paramAnno,
                      argAnno,
                      funAnno,
                      argAnnos));

                    return {tvid, instantiations, aliases, intros};
                  }

                  else if (paramAst.body.length <= argArity) { // t<a> | t<a, b> ~ Adt<c, d>
                    ({instantiations, aliases} = instantiate( // t ~ Adt | Adt<b>
                      (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                        paramAst.name,
                        paramAst.scope,
                        paramAst.position,
                        Array(paramAst.body.length).fill(Partial)),
                      argArity === paramAst.body.length
                        ? Adt(argAst.cons, Array(argArity).fill(Partial))
                        : Adt(
                            argAst.cons,
                            argAst.body.slice(0, argArity - paramAst.body.length)
                              .concat(Array(paramAst.body.length).fill(Partial))),
                      (refAst, fromAst, toAst) => {
                        if (refAst[TAG] === fromAst[TAG]
                          && refAst.name === fromAst.name) {
                            if (refAst.body.length === 0)
                              return toAst;

                            else if (refAst.body.length < toAst.body.length)
                              return Adt(
                                toAst.cons,
                                toAst.body.slice(0, -refAst.body.length)
                                  .concat(refAst.body));

                            else return Adt(
                              toAst.cons,
                              refAst.body);
                        }

                        else return refAst;
                      },
                      lamIndex,
                      argIndex,
                      {tvid, instantiations, aliases, intros},
                      paramAnno,
                      argAnno,
                      funAnno,
                      argAnnos));

                    return argAst.body.slice(argArity - paramAst.body.length).reduce((acc, field, i) =>
                      unifyTypes(
                        paramAst.body[i],
                        field,
                        lamIndex,
                        argIndex,
                        {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                        paramAnno,
                        argAnno,
                        funAnno,
                        argAnnos), {tvid, instantiations, aliases, intros});
                  }

                  else // t<a, b, c> ~ Adt<d, e>
                    unificationError(
                      serializeAst(argAst),
                      serializeAst(paramAst),
                      lamIndex,
                      argIndex,
                      instantiations,
                      paramAnno,
                      argAnno,
                      funAnno,
                      argAnnos);
                }

                case "Arr":
                case "Nea": { // t<a> ~ [b] | [1b]
                  ({instantiations, aliases} = instantiate( // t ~ [] | [1]
                    (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                      paramAst.name,
                      paramAst.scope,
                      paramAst.position,
                      [Partial]),
                    (argAst[TAG] === "Arr" ? Arr : Nea) (Partial),
                    (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                      && refAst.name === fromAst.name
                        ? (toAst[TAG] === "Arr" ? Arr : Nea) (refAst.body[0])
                        : refAst,
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos));

                  return unifyTypes(
                    paramAst.body[0],
                    argAst.body,
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos);
                }

                case "Fun": { // zyx
                  const arityDiff = argArity - paramAst.body.length;

                  if (arityDiff === 0) { // t<a> ~ (() => b) | t<a, b> ~ (c => d) | t<a, b, c> ~ (d, e => f)

                    // unify domain
            
                    switch (argAst.body.lambdas[0] [TAG]) {
                      case "Arg0": {
                        ({instantiations, aliases} = instantiate( // t ~ (=>)
                          (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                            paramAst.name,
                            paramAst.scope,
                            paramAst.position,
                            [Partial]),
                          Fun([new Arg0()], Partial),
                          (refAst, fromAst, toAst) => {
                            if (refAst[TAG] === fromAst[TAG]
                              && refAst.name === fromAst.name) {
                                return Forall(
                                  new Set(),
                                  ".",
                                  Fun(
                                    [new Arg0()],
                                    mapAst(refAst_ => {
                                      if (refAst_[TAG] === "MetaTV" || refAst_[TAG] === "RigidTV")
                                        return (refAst_[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                                          refAst_.name,
                                          refAst_.scope,
                                          "codomain",
                                          refAst_.body);
                                      
                                      else return refAst_;
                                    }) (refAst.body[0])));
                            }

                            else return refAst;
                          },
                          lamIndex,
                          argIndex,
                          {tvid, instantiations, aliases, intros},
                          paramAnno,
                          argAnno,
                          funAnno,
                          argAnnos));

                        break;
                      }

                      case "Arg1": {
                        ({instantiations, aliases} = instantiate( // t ~ (=>)
                          (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                            paramAst.name,
                            paramAst.scope,
                            paramAst.position,
                            [Partial, Partial]),
                          Fun([new Arg1(Partial)], Partial),
                          (refAst, fromAst, toAst) => {
                            if (refAst[TAG] === fromAst[TAG]
                              && refAst.name === fromAst.name) {
                                return Forall(
                                  new Set(),
                                  ".",
                                  Fun(
                                    [new Arg1(refAst.body[0])],
                                    mapAst(refAst_ => {
                                      if (refAst_[TAG] === "MetaTV" || refAst_[TAG] === "RigidTV")
                                        return (refAst_[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                                          refAst_.name,
                                          refAst_.scope,
                                          "codomain",
                                          refAst_.body);
                                      
                                      else return refAst_;
                                    }) (refAst.body[1])));
                            }

                            else return refAst;
                          },
                          lamIndex,
                          argIndex,
                          {tvid, instantiations, aliases, intros},
                          paramAnno,
                          argAnno,
                          funAnno,
                          argAnnos));

                        ({tvid, instantiations, aliases, intros} = unifyTypes(
                          paramAst.body[0],
                          argAst.body.lambdas[0] [0],
                          lamIndex,
                          argIndex,
                          {tvid, instantiations, aliases, intros},
                          paramAnno,
                          argAnno,
                          funAnno,
                          argAnnos));

                        break;
                      }

                      case "Args": {
                        ({instantiations, aliases} = instantiate( // t ~ (=>)
                          (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                            paramAst.name,
                            paramAst.scope,
                            paramAst.position,
                            Array(paramAst.body.length).fill(Partial)),
                          Fun([
                            Args.fromArr(Array(argAst.body.lambdas[0].length).fill(Partial))],
                            Partial),
                          (refAst, fromAst, toAst) => {
                            if (refAst[TAG] === fromAst[TAG]
                              && refAst.name === fromAst.name) {
                                return Forall(
                                  new Set(),
                                  ".",
                                  Fun(
                                    [Args.fromArr(refAst.body.slice(0, -1))],
                                    mapAst(refAst_ => {
                                      if (refAst_[TAG] === "MetaTV" || refAst_[TAG] === "RigidTV")
                                        return (refAst_[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                                          refAst_.name,
                                          refAst_.scope,
                                          "codomain",
                                          refAst_.body);
                                      
                                      else return refAst_;
                                    }) (refAst.body[refAst.body.length - 1])));
                            }
                            
                            else return refAst;
                          },
                          lamIndex,
                          argIndex,
                          {tvid, instantiations, aliases, intros},
                          paramAnno,
                          argAnno,
                          funAnno,
                          argAnnos));

                        ({tvid, instantiations, aliases, intros} = argAst.body.lambdas[0].reduce((acc, ast, i) =>
                          unifyTypes(
                            paramAst.body[i],
                            ast,
                            lamIndex,
                            argIndex,
                            {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                            paramAnno,
                            argAnno,
                            funAnno,
                            argAnnos), {tvid, instantiations, aliases, intros}));

                        break;
                      }

                      default: // Argv/Argsv are excluded
                        unificationError(
                          serializeAst(paramAst),
                          serializeAst(argAst),
                          lamIndex,
                          argIndex,
                          instantiations,
                          paramAnno,
                          argAnno,
                          funAnno,
                          argAnnos);
                    }
                  }

                  else if (arityDiff < 0) // t<a, b> ~ (() => c) | t<a, b, c> ~ (d => e) | t<a, b, c, d> ~ (e, f => g)
                    unificationError(
                      serializeAst(paramAst),
                      serializeAst(argAst),
                      lamIndex,
                      argIndex,
                      instantiations,
                      paramAnno,
                      argAnno,
                      funAnno,
                      argAnnos);

                  else { // t<a> ~ (b => c) | t<a, b> ~ (c, d => e)

                    // unify domain
            
                    switch (argAst.body.lambdas[0] [TAG]) {
                      case "Arg0": throw new TypeError(
                        "internal error: unexpected thunk");

                      case "Arg1": {
                        ({instantiations, aliases} = instantiate( // t ~ (b => )
                          (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                            paramAst.name,
                            paramAst.scope,
                            paramAst.position,
                            [Partial]),
                          Fun([argAst.body.lambdas[0]], Partial),
                          (refAst, fromAst, toAst) => {
                            if (refAst[TAG] === fromAst[TAG]
                              && refAst.name === fromAst.name) {
                                return Forall(
                                  new Set(),
                                  ".",
                                  Fun(
                                    [toAst.body.lambdas[0]],
                                    mapAst(refAst_ => {
                                      if (refAst_[TAG] === "MetaTV" || refAst_[TAG] === "RigidTV")
                                        return (refAst_[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                                          refAst_.name,
                                          refAst_.scope,
                                          "codomain",
                                          refAst_.body);
                                      
                                      else return refAst_;
                                    }) (refAst.body[0])));
                            }

                            else return refAst;
                          },
                          lamIndex,
                          argIndex,
                          {tvid, instantiations, aliases, intros},
                          paramAnno,
                          argAnno,
                          funAnno,
                          argAnnos));

                        break;
                      }

                      case "Args": {
                        ({instantiations, aliases} = instantiate( // t ~ (b, c =>)
                          (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                            paramAst.name,
                            paramAst.scope,
                            paramAst.position,
                            Array(paramAst.body.length).fill(Partial)),
                          Fun([
                            argAst.body.lambdas[0]
                              .slice(0, arityDiff)
                              .concat(Array(paramAst.body.length - 1).fill(Partial))],
                            Partial),
                          (refAst, fromAst, toAst) => {
                            if (refAst[TAG] === fromAst[TAG]
                              && refAst.name === fromAst.name) {
                                return Forall(
                                  new Set(),
                                  ".",
                                  Fun(
                                    [toAst.body.lambdas[0]
                                      .slice(0, arityDiff)
                                      .concat(Args.fromArr(refAst.body.slice(0, -1)))],
                                    mapAst(refAst_ => {
                                      if (refAst_[TAG] === "MetaTV" || refAst_[TAG] === "RigidTV")
                                        return (refAst_[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                                          refAst_.name,
                                          refAst_.scope,
                                          "codomain",
                                          refAst_.body);
                                      
                                      else return refAst_;
                                    }) (refAst.body[refAst.body.length - 1])));
                            }

                            else return refAst;
                          },
                          lamIndex,
                          argIndex,
                          {tvid, instantiations, aliases, intros},
                          paramAnno,
                          argAnno,
                          funAnno,
                          argAnnos));

                        ({tvid, instantiations, aliases, intros} = argAst.body.lambdas[0]
                          .slice(arityDiff)
                          .reduce((acc, ast, i) =>
                            unifyTypes(
                              paramAst.body[i],
                              ast,
                              lamIndex,
                              argIndex,
                              {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                              paramAnno,
                              argAnno,
                              funAnno,
                              argAnnos), {tvid, instantiations, aliases, intros}));

                        break;
                      }

                      default: // Argv/Argsv are excluded
                        unificationError(
                          serializeAst(paramAst),
                          serializeAst(argAst),
                          lamIndex,
                          argIndex,
                          instantiations,
                          paramAnno,
                          argAnno,
                          funAnno,
                          argAnnos);
                    }
                  }

                  // unify codomain

                  if (argAst.body.lambdas.length === 1) {
                    return unifyTypes(
                      paramAst.body[paramAst.body.length - 1],
                      argAst.body.result,
                      lamIndex,
                      argIndex,
                      {tvid, instantiations, aliases, intros},
                      paramAnno,
                      argAnno,
                      funAnno,
                      argAnnos);
                  }

                  else {
                    const argAst_ = Fun(
                      argAst.body.lambdas.slice(1),
                      argAst.body.result);

                    return unifyTypes(
                      paramAst.body[paramAst.body.length - 1],
                      argAst_,
                      lamIndex,
                      argIndex,
                      {tvid, instantiations, aliases, intros},
                      paramAnno,
                      argAnno,
                      funAnno,
                      argAnnos);
                  }
                }

                case "Native": { // t<a> | t<a, b> ~ Set<c, d>
                  ({instantiations, aliases} = instantiate( // t ~ Set | Set<c>
                    (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                      paramAst.name,
                      paramAst.scope,
                      paramAst.position,
                      Array(paramAst.body.length).fill(Partial)),
                    argArity === paramAst.body.length
                      ? Native(argAst.cons, Array(argArity).fill(Partial))
                      : Native(
                          argAst.cons,
                          argAst.body.slice(0, argArity - paramAst.body.length)
                            .concat(Array(paramAst.body.length).fill(Partial))),
                    (refAst, fromAst, toAst) => {
                      if (refAst[TAG] === fromAst[TAG]
                        && refAst.name === fromAst.name)
                          return refAst.body.length === toAst.body.length
                            ? Native(toAst.cons, refAst.body)
                            : Native(
                                toAst.cons,
                                toAst.body.slice(0, toAst.body.length - refAst.body.length)
                                  .concat(refAst.body));
                        
                      else return refAst;
                    },
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos));

                  return argAst.body.slice(argArity - paramAst.body.length).reduce((acc, field, i) =>
                    unifyTypes(
                      paramAst.body[i],
                      field,
                      lamIndex,
                      argIndex,
                      {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                      paramAnno,
                      argAnno,
                      funAnno,
                      argAnnos), {tvid, instantiations, aliases, intros});
                }

                case "Obj": { // t<a> | t<a, b> ~ {foo: b, bar: c}
                  ({instantiations, aliases} = instantiate( // t ~ {foo:, bar:} | {foo: b, bar:}
                    (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                      paramAst.name,
                      paramAst.scope,
                      paramAst.position,
                      Array(paramAst.body.length).fill(Partial)),
                    argArity === paramAst.body.length
                      ? Obj(
                          argAst.cons,
                          argAst.props,
                          argAst.row,
                          Array(argArity)
                            .fill(Partial)
                            .map((field, i) => ({k: argAst.props[i], v: field})))
                      : Obj(
                          argAst.cons,
                          argAst.props,
                          argAst.row,
                          argAst.body.slice(0, argArity - paramAst.body.length)
                            .concat(Array(paramAst.body.length)
                              .fill(Partial)
                              .map((field, i) => ({k: argAst.props[i], v: field})))),
                    (refAst, fromAst, toAst) => {
                      if (refAst[TAG] === fromAst[TAG]
                        && refAst.name === fromAst.name) {
                          if (refAst.body.length === toAst.body.length)
                            return Obj(
                              toAst.cons,
                              toAst.props,
                              toAst.row,
                              refAst.body.map((field, i) =>
                                ({k: toAst.props[i], v: field})));

                           else return Obj(
                              toAst.cons,
                              toAst.props,
                              toAst.row,
                              toAst.body.slice(0, toAst.body.length - refAst.body.length)
                                .concat(refAst.body.map((field, i) =>
                                  ({k: toAst.props[i + toAst.body.length - refAst.body.length], v: field}))));
                        }
                        
                        else return refAst;
                    },
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos));

                  return argAst.body.slice(argArity - paramAst.body.length).reduce((acc, field, i) =>
                    unifyTypes(
                      paramAst.body[i],
                      field.v,
                      lamIndex,
                      argIndex,
                      {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                      paramAnno,
                      argAnno,
                      funAnno,
                      argAnnos), {tvid, instantiations, aliases, intros});
                }

                case "Tup": { // t<a> | t<a, b> ~ [c, d] | [c, d, e]
                  ({instantiations, aliases} = instantiate( // t ~ [,] | [c,]
                    (paramAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                      paramAst.name,
                      paramAst.scope,
                      paramAst.position,
                      Array(paramAst.body.length).fill(Partial)),
                    argArity === paramAst.body.length
                      ? Tup(argArity, Array(argArity).fill(Partial))
                      : Tup(
                          argArity,
                          argAst.body.slice(0, argArity - paramAst.body.length)
                            .concat(Array(paramAst.body.length).fill(Partial))),
                    (refAst, fromAst, toAst) => {
                      if (refAst[TAG] === fromAst[TAG]
                        && refAst.name === fromAst.name)
                          return refAst.body.length === toAst.body.length
                            ? Tup(toAst.body.length, refAst.body)
                            : Tup(
                                toAst.body.length,
                                toAst.body.slice(0, toAst.body.length - refAst.body.length)
                                  .concat(refAst.body));
                      
                      else return refAst;
                    },
                    lamIndex,
                    argIndex,
                    {tvid, instantiations, aliases, intros},
                    paramAnno,
                    argAnno,
                    funAnno,
                    argAnnos));

                  return argAst.body.slice(argArity - paramAst.body.length).reduce((acc, field, i) =>
                    unifyTypes(
                      paramAst.body[i],
                      field,
                      lamIndex,
                      argIndex,
                      {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                      paramAnno,
                      argAnno,
                      funAnno,
                      argAnnos), {tvid, instantiations, aliases, intros});
                }

                default:
                  throw new TypeError(
                    "internal error: unknown value constructor at unifyTypes");
              }
            }
          }
        }
      }
    }

    case "Native": {
      switch (argAst[TAG]) {
        case "BoundTV": // Map<a, b> ~ bound c
          throw new TypeError(
            "internal error: unexpected bound type variable");

        case "Forall": // Map<a, b> ~ forall
          return unifyTypes(
            paramAst,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);

        case "MetaTV":
        case "RigidTV": {
          if (argAst.body.length === 0) { // Map<a, b> ~ c
            ({instantiations, aliases} = instantiate(
              argAst,
              paramAst,
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? toAst
                  : refAst,
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          else if (argAst.body.length <= paramAst.body.length) { // Map<a, b> ~ u<c> | u<c, d>
            ({instantiations, aliases} = instantiate( // Map | Map<a> ~ u
              (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                argAst.name,
                argAst.scope,
                argAst.position,
                Array(argAst.body.length).fill(Partial)),
              paramAst.body.length === argAst.body.length
                ? Native(paramAst.cons, Array(paramAst.body.length).fill(Partial))
                : Native(
                    paramAst.cons,
                    paramAst.body.slice(0, paramAst.body.length - argAst.body.length)
                      .concat(Array(argAst.body.length).fill(Partial))),
              (refAst, fromAst, toAst) => {
                if (refAst[TAG] === fromAst[TAG]
                  && refAst.name === fromAst.name)
                    return refAst.body.length === toAst.body.length
                      ? Native(toAst.cons, refAst.body)
                      : Native(
                          toAst.cons,
                          toAst.body.slice(0, toAst.body.length - refAst.body.length)
                            .concat(refAst.body));

                else return refAst;
              },
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return paramAst.body.slice(paramAst.body.length - argAst.body.length).reduce((acc, field, i) =>
              unifyTypes(
                field,
                argAst.body[i],
                lamIndex,
                argIndex,
                {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos), {tvid, instantiations, aliases, intros});
          }

          else // Map<a, b> ~ u<c, d, e>
            unificationError(
              serializeAst(paramAst),
              serializeAst(argAst),
              lamIndex,
              argIndex,
              instantiations,
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
        }

        case "Native": { // Map<a, b> ~ Set<c, d>
          if (paramAst.cons !== argAst.cons) {
            throw new TypeError(cat(
              "type constructor mismatch\n",
              `expected: ${paramAst.cons}\n`,
              `received: ${argAst.cons}\n`,
              "while unifying\n",
              `${paramAnno}\n`,
              `${argAnno}\n`,
              extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));
          }

          else {
            return paramAst.body.reduce((acc, field, i) =>
              unifyTypes(
                field,
                argAst.body[i],
                lamIndex,
                argIndex,
                {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos), {tvid, instantiations, aliases, intros});
          }
        }

        case "Partial": { // Map<a, b> ~ __
          ({instantiations, aliases} = instantiate(
            argAst,
            paramAst,
            (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
              && refAst.name === fromAst.name
                ? toAst
                : refAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos));

          return {tvid, instantiations, aliases, intros};
        }

        default: // Map<a, b> ~ composite type except U<b>
          unificationError(
            serializeAst(paramAst),
            serializeAst(argAst),
            lamIndex,
            argIndex,
            instantiations,
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }
    }

    case "Nea": {
      switch (argAst[TAG]) {
        case "BoundTV": // [1a] ~ bound b
          throw new TypeError(
            "internal error: unexpected bound type variable");

        case "Forall": // [1a] ~ forall
          return unifyTypes(
            paramAst,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);

        case "MetaTV":
        case "RigidTV": { // [1a] ~ b
          if (argAst.body.length === 0) { // [1a] ~ b
            ({instantiations, aliases} = instantiate(
              argAst,
              paramAst,
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? toAst
                  : refAst,
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          else if (argAst.body.length === 1) { // [1a] ~ u<b>
            ({instantiations, aliases} = instantiate( // [1] ~ u
              (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                argAst.name,
                argAst.scope,
                argAst.position,
                [Partial]),
              Nea(Partial),
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? Nea(refAst.body[0])
                  : refAst,
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return unifyTypes(
              paramAst.body,
              argAst.body[0],
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
          }

          else // [1a] ~ u<b, c>
            unificationError(
              serializeAst(paramAst),
              serializeAst(argAst),
              lamIndex,
              argIndex,
              instantiations,
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
        }

        case "Nea": // [1a] ~ [1b]
          return unifyTypes(
            paramAst.body,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
        
        case "Partial": { // [1a] ~ __
          ({instantiations, aliases} = instantiate(
            argAst,
            paramAst,
            (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
              && refAst.name === fromAst.name
                ? toAst
                : refAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos));

          return {tvid, instantiations, aliases, intros};
        }

        default: // [1a] ~ composite type except [1b]
          unificationError(
            serializeAst(paramAst),
            serializeAst(argAst),
            lamIndex,
            argIndex,
            instantiations,
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }
    }

    case "Obj": {
      switch (argAst[TAG]) {
        case "BoundTV": // {foo: a, bar: b} ~ bound c
          throw new TypeError(
            "internal error: unexpected bound type variable");

        case "Forall": // {foo: a, bar: b} ~ forall
          return unifyTypes(
            paramAst,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);

        case "MetaTV":
        case "RigidTV": {
          if (argAst.body.length === 0) { // {foo: a, bar: b} ~ c
            ({instantiations, aliases} = instantiate(
              argAst,
              paramAst,
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? toAst
                  : refAst,
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          else if (argAst.body.length <= paramAst.body.length) { // {foo: a, bar: b} ~ u<c> | u<c, d>
            ({instantiations, aliases} = instantiate( // {foo:, bar:} | {foo: a, bar:} ~ u
              (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                argAst.name,
                argAst.scope,
                argAst.position,
                Array(argAst.body.length).fill(Partial)),
              paramAst.body.length === argAst.body.length
                ? Obj(
                    paramAst.cons,
                    paramAst.props,
                    paramAst.row,
                    Array(paramAst.body.length)
                      .fill(Partial)
                      .map((field, i) => ({k: paramAst.props[i], v: field})))
                : Obj(
                    paramAst.cons,
                    paramAst.props,
                    paramAst.row,
                    paramAst.body.slice(0, paramAst.body.length - argAst.body.length)
                      .concat(Array(argAst.body.length)
                        .fill(Partial)
                        .map((field, i) => ({k: paramAst.props[i], v: field})))),
              (refAst, fromAst, toAst) => {
                if (refAst[TAG] === fromAst[TAG]
                  && refAst.name === fromAst.name) {
                    if (refAst.body.length === toAst.body.length)
                      return Obj(
                        toAst.cons,
                        toAst.props,
                        toAst.row,
                        refAst.body.map((field, i) =>
                          ({k: toAst.props[i], v: field})));

                    else return Obj(
                      toAst.cons,
                      toAst.props,
                      toAst.row,
                      toAst.body.slice(0, toAst.body.length - refAst.body.length)
                        .concat(refAst.body.map((field, i) =>
                          ({k: toAst.props[i + toAst.body.length - refAst.body.length], v: field}))));
                }

                else return refAst;
              },
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return paramAst.body.slice(paramAst.body.length - argAst.body.length).reduce((acc, field, i) =>
              unifyTypes(
                field,
                argAst.body[i].v,
                lamIndex,
                argIndex,
                {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos), {tvid, instantiations, aliases, intros});
          }

          else // {foo: a, bar: b} ~ u<c, d, e>
            unificationError(
              serializeAst(paramAst),
              serializeAst(argAst),
              lamIndex,
              argIndex,
              instantiations,
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
        }

        case "Obj": { // {foo: a, bar: b} ~ {foo: c, bar: d}

          /* Objects are treated as an unordered map of key-value pairs. */

          // {foo: a, bar: b | x} ~ {foo: c | y} -- FAILS (arg row is ignored)
          // {foo: a | x} ~ {foo: c, bar: d | y} -- OK with x ~ bar: d (y remain unresolved)
          // {foo: a, bar: b | x} ~ {foo: c, bar: d | y} -- OK with x ~ "" (y remain unresolved)

          // {foo: a, bar: b | x} ~ {foo: c} -- FAILS
          // {foo: a | x} ~ {foo: c, bar: d} -- OK with x ~ bar: d
          // {foo: a, bar: b | x} ~ {foo: c, bar: d} -- OK with x ~ ""

          // {foo: a, bar: b} ~ {foo: c | y} -- FAILS (arg row is ignored)
          // {foo: a} ~ {foo: c, bar: d | y} -- FAILS
          // {foo: a, bar: b} ~ {foo: c, bar: d | y} -- OK (arg row is ignored)

          if ((paramAst.cons !== null || argAst.cons !== null)
            && paramAst.cons !== argAst.cons) {
              throw new TypeError(cat(
                "type constructor mismatch\n",
                `expected: ${paramAst.cons}\n`,
                `received: ${argAst.cons}\n`,
                "while unifying\n",
                `${paramAnno}\n`,
                `${argAnno}\n`,
                extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));
          }

          else if (paramAst.row !== null) { // {foo: a | x} ~ {foo: b, bar: c}
            const paramMap = new Map([
              ...paramAst.body.map(({k, v}) => [k, v])]);

            const argMap = new Map([
              ...argAst.body.map(({k, v}) => [k, v])]);

            const diffMap = argAst.body.reduce((acc, {k, v}) =>
              paramMap.has(k)
                ? acc : acc.set(k, v), new Map());

            const rowType = [];

            diffMap.forEach((v, k) => {
              rowType.push({k, v});
            });

            paramMap.forEach((v, k) => {
              if (!argMap.has(k))
                throw new TypeError(cat(
                  "structural type mismatch\n",
                  `required property "${k}" is missing\n`,
                  "while unifying\n",
                  `${paramAnno}\n`,
                  `${argAnno}\n`,
                  extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));
            });

            ({tvid, instantiations, aliases, intros} = paramAst.body.reduce((acc, {k, v}, i) => {
              return unifyTypes(
                v,
                argMap.get(k),
                lamIndex,
                argIndex,
                {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos)
            }, {tvid, instantiations, aliases, intros}));

            ({instantiations, aliases} = instantiate(
              paramAst.row,
              RowType(rowType),
              (refAst, fromAst, toAst) => {
                if (refAst[TAG] === "Obj"
                && refAst.row !== null
                && refAst.row.name === fromAst.name
                && fromAst[TAG] === "RowVar") {
                  return Obj(
                    refAst.cons,
                    refAst.props.concat(
                      toAst.body.map(({k, v}) => k)),
                    argAst.row,
                    refAst.body.concat(toAst.body))
                }
                
                else return refAst;
              },
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          else if (paramAst.body.length !== argAst.body.length) { // {foo: a, bar: b} ~ {foo: c} | {foo: c, bar: d, baz: e}
            throw new TypeError(cat(
              "structural type mismatch\n",
              `expected: ${serializeAst(paramAst)}\n`,
              `received: ${serializeAst(argAst)}\n`,
              "while unifying\n",
              `${paramAnno}\n`,
              `${argAnno}\n`,
              extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));
          }

          else { // {foo: a, bar: b} ~ {foo: c, bar: d}
            const argMap = new Map([
              ...argAst.body.map(({k, v}) => [k, v])]);

            return paramAst.body.reduce((acc, {k, v}, i) => {
              if (!argMap.has(k))
                throw new TypeError(cat(
                  "structural type mismatch\n",
                  `expected property: ${k}\n`,
                  `received property: ${argAst.body[i].k}\n`,
                  "while unifying\n",
                  `${paramAnno}\n`,
                  `${argAnno}\n`,
                  extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));

              else
                return unifyTypes(
                  v,
                  argMap.get(k),
                  lamIndex,
                  argIndex,
                  {tvid, instantiations, aliases, intros},
                  paramAnno,
                  argAnno,
                  funAnno,
                  argAnnos)
            }, instantiations);
          }
        }
        
        case "Partial": { // {foo: a, bar: b} ~ __
          ({instantiations, aliases} = instantiate(
            argAst,
            paramAst,
            (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
              && refAst.name === fromAst.name
                ? toAst
                : refAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos));

          return {tvid, instantiations, aliases, intros};
        }

        case "This": { // {foo: a, bar: b} ~ this*
          return unifyTypes(
            paramAst,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
        }

        default: // {foo: a, bar: b} ~ composite type except {}
          unificationError(
            serializeAst(paramAst),
            serializeAst(argAst),
            lamIndex,
            argIndex,
            instantiations,
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }
    }

    case "Partial": {
      switch (argAst[TAG]) {
        case "Partial":
          return {tvid, instantiations, aliases, intros}; // __ ~ __

        case "Tconst": { // __ ~ U
          ({instantiations, aliases} = instantiate(
            paramAst,
            argAst,
            (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
              && refAst.name === fromAst.name
                ? toAst
                : refAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos));

          return {tvid, instantiations, aliases, intros};
        }

        default: // __ ~ any other type expect Partial
          unificationError(
            serializeAst(paramAst),
            serializeAst(argAst),
            lamIndex,
            argIndex,
            instantiations,
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }
    }

    case "Tconst": {
      switch (argAst[TAG]) {
        case "BoundTV": // T ~ bound b
          throw new TypeError(
            "internal error: unexpected bound type variable");

        case "Forall": // T ~ forall
          return unifyTypes(
            paramAst,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);

        case "MetaTV":
        case "RigidTV": {
          if (argAst.body.length === 0) { // T ~ b
            ({instantiations, aliases} = instantiate(
              argAst,
              paramAst,
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? toAst
                  : refAst,
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          else // T ~ u<b>
            unificationError(
              serializeAst(paramAst),
              serializeAst(argAst),
              lamIndex,
              argIndex,
              instantiations,
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
        }

        case "Partial": { // T ~ __
          ({instantiations, aliases} = instantiate(
            argAst,
            paramAst,
            (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
              && refAst.name === fromAst.name
                ? toAst
                : refAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos));

          return {tvid, instantiations, aliases, intros};
        }

        case "Tconst": { // T ~ U
          if (paramAst.name === argAst.name)
            return {tvid, instantiations, aliases, intros};

          else
            unificationError(
              paramAst.name,
              argAst.name,
              lamIndex,
              argIndex,
              instantiations,
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
        }

        default: // T ~ composite type except U
          unificationError(
            paramAst.name,
            serializeAst(argAst),
            lamIndex,
            argIndex,
            instantiations,
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }
    }

    case "This": {
      switch (argAst[TAG]) {
        case "Obj": { // this* ~ {foo: b, bar: c}
          return unifyTypes(
            paramAst.body,
            argAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
        }

        case "This": // this* ~ this*
          return {tvid, instantiations, aliases, intros};

        default:
          unificationError(
            serializeAst(paramAst),
            serializeAst(argAst),
            lamIndex,
            argIndex,
            instantiations,
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }
    }

    case "Tup": {
      switch (argAst[TAG]) {
        case "BoundTV": // [a, b] ~ bound c
          throw new TypeError(
            "internal error: unexpected bound type variable");

        case "Forall": // [a, b] ~ forall
          return unifyTypes(
            paramAst,
            argAst.body,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);

        case "MetaTV":
        case "RigidTV": {
          if (argAst.body.length === 0) { // [a, b] ~ c
            ({instantiations, aliases} = instantiate(
              argAst,
              paramAst,
              (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
                && refAst.name === fromAst.name
                  ? toAst
                  : refAst,
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return {tvid, instantiations, aliases, intros};
          }

          else if (argAst.body.length <= paramAst.body.length) { // [a, b] ~ u<c> | u<c, d>
            ({instantiations, aliases} = instantiate( // [,] | [a,] ~ u
              (argAst[TAG] === "MetaTV" ? MetaTV : RigidTV) (
                argAst.name,
                argAst.scope,
                argAst.position,
                Array(argAst.body.length).fill(Partial)),
              paramAst.body.length === argAst.body.length
                ? Tup(paramAst.body.length, Array(paramAst.body.length).fill(Partial))
                : Tup(
                    paramAst.body.length,
                    paramAst.body.slice(0, paramAst.body.length - argAst.body.length)
                      .concat(Array(argAst.body.length).fill(Partial))),
              (refAst, fromAst, toAst) => {
                if (refAst[TAG] === fromAst[TAG]
                  && refAst.name === fromAst.name)
                    return refAst.body.length === toAst.body.length
                      ? Tup(toAst.body.length, refAst.body)
                      : Tup(
                          toAst.body.length,
                          toAst.body.slice(0, toAst.body.length - refAst.body.length)
                            .concat(refAst.body));

                else return refAst;
              },
              lamIndex,
              argIndex,
              {tvid, instantiations, aliases, intros},
              paramAnno,
              argAnno,
              funAnno,
              argAnnos));

            return paramAst.body.slice(paramAst.body.length - argAst.body.length).reduce((acc, field, i) =>
              unifyTypes(
                field,
                argAst.body[i],
                lamIndex,
                argIndex,
                {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos), {tvid, instantiations, aliases, intros});
          }

          else // [a, b] ~ u<c, d, e>
            unificationError(
              serializeAst(paramAst),
              serializeAst(argAst),
              lamIndex,
              argIndex,
              instantiations,
              paramAnno,
              argAnno,
              funAnno,
              argAnnos);
        }

        case "Partial": { // [a, b] ~ __
          ({instantiations, aliases} = instantiate(
            argAst,
            paramAst,
            (refAst, fromAst, toAst) => refAst[TAG] === fromAst[TAG]
              && refAst.name === fromAst.name
                ? toAst
                : refAst,
            lamIndex,
            argIndex,
            {tvid, instantiations, aliases, intros},
            paramAnno,
            argAnno,
            funAnno,
            argAnnos));

          return {tvid, instantiations, aliases, intros};
        }

        case "Tup": { // [a, b] ~ [c, d]
          if (paramAst.body.length !== argAst.body.length)
            throw new TypeError(cat(
              "Tuple mismatch\n",
              `expected: ${serializeAst(paramAst)}\n`,
              `received: ${serializeAst(argAst)}\n`,
              "while unifying\n",
              `${paramAnno}\n`,
              `${argAnno}\n`,
              extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));

          else
            return paramAst.body.reduce((acc, field, i) =>
              unifyTypes(
                field,
                argAst.body[i],
                lamIndex,
                argIndex,
                {tvid: acc.tvid, instantiations: acc.instantiations, aliases: acc.aliases, intros: acc.intros},
                paramAnno,
                argAnno,
                funAnno,
                argAnnos), {tvid, instantiations, aliases, intros});
        }

        default: // [a, b] ~ composite type except [c, d]
          unificationError(
            serializeAst(paramAst),
            serializeAst(argAst),
            lamIndex,
            argIndex,
            instantiations,
            paramAnno,
            argAnno,
            funAnno,
            argAnnos);
      }
    }

    default: throw new TypeError(
      "internal error: unknown type");
  }
};


/***[ Combinators ]***********************************************************/


const unificationError = (paramAnno_, argAnno_, lamIndex, argIndex, instantiations, paramAnno, argAnno, funAnno, argAnnos) => {
  throw new TypeError(cat(
    "type mismatch\n",
    "cannot unify the following types:\n",
    `${paramAnno_}\n`,
    `${argAnno_}\n`,
    paramAnno !== paramAnno_ && argAnno !== argAnno_
      ? cat(
        "while unifying\n",
        `${paramAnno}\n`,
        `${argAnno}\n`)
      : "",
    extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));
};


/******************************************************************************
*******************************************************************************
*******************************[ INSTANTIATION ]*******************************
*******************************************************************************
******************************************************************************/


/* Rigid TVs that are on the LHS of a nested function type must only be
instantiated with themselves or with meta TVs within the same scope. The latter
holds, if the meta TV is introduced within the same scope or later during
unification. */

const instantiate = (key, value, substitutor, lamIndex, argIndex, state, paramAnno, argAnno, funAnno, argAnnos) => {

  // destructure state

  let {tvid, instantiations, aliases, intros} = state;

  // skip scope check for row variables

  if (key[TAG] === "RowVar")
    return setNestedMap(
      key.name, `${key.name} ~ ${serializeAst(value)}`, {key, value, substitutor})
        (instantiations);

  // ensure that key is a TV

  else if (!isTV(key)) {
    if (isTV(value)) 
      [key, value] = [value, key]; // swap values

    else
      throw new TypeError(cat(
        `can only instantiate type variables with another type\n`,
        `but "${serializeAst(key)}" received\n`,
        "while unifying\n",
        `${paramAnno}\n`,
        `${argAnno}\n`,
        extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));
  }

  // store aliases due to commutativity of type equality

  else if (isTV(value)) {
    if (aliases.has(key.name))
      aliases.get(key.name).set(`${key.name} ~ ${value.name}`, [key, value]);

    else
      aliases.set(key.name, new Map([[`${key.name} ~ ${value.name}`, [key, value]]]));

    if (aliases.has(value.name))
      aliases.get(value.name).set(`${value.name} ~ ${key.name}`, [value, key]);

    else
      aliases.set(value.name, new Map([[`${value.name} ~ ${key.name}`, [value, key]]]));
  }

  // rigid TV ~ ?

  if (key[TAG] === "RigidTV") {

    // rigid TV ~ meta TV

    if (value[TAG] === "MetaTV")
      escapeCheck(key, value, instantiations, intros, aliases, new Set(), null, null, paramAnno, argAnno, funAnno, argAnnos);

    // rigid TV ~ rigid TV

    else if (value[TAG] === "RigidTV")
      escapeCheck(key, value, instantiations, intros, aliases, new Set(), null, null, paramAnno, argAnno, funAnno, argAnnos);

    // rigid TV ~ composite type

    else if (!isTV(value))
      throw new TypeError(cat(
        `cannot instantiate rigid type variable "${key.name}"\n`,
        `with "${serializeAst(value)}"\n`,
        "rigid type variables can only be instantiated with themselves\n",
        "or with meta type variables within the same scope\n",
        "while unifying\n",
        `${paramAnno}\n`,
        `${argAnno}\n`,
        extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));
  }

  // meta TV ~ ?

  else {

    // meta TV ~ rigid TV

    if (value[TAG] === "RigidTV")
      escapeCheck(value, key, instantiations, intros, aliases, new Set(), null, null, paramAnno, argAnno, funAnno, argAnnos);

    // meta TV ~ meta TV is skipped, because there are no restrictions

    // meta TV ~ composite type possibly containing rigid TVs

    reduceAst((acc, value_) => {
      if (value_[TAG] === "RigidTV")
        escapeCheck(value_, key, instantiations, intros, aliases, new Set(), null, null, paramAnno, argAnno, funAnno, argAnnos);

      else return acc;
    }, null) (value);
  }

  /* Check if the current TV already has an instantiation and if any, try to
  unify both. If the unification with the first entry succeeds, the process can
  be terminated prematurely, because other possible entries are guaranteed to
  pass unification as well. Any new instantiations or aliases, which may occur
  during unification, are discarded. The `try`/`catch` block is required to
  improve error messaging. */

  if (instantiations.has(key.name)
    && instantiations.get(key.name).size > 0) {
      try {
        unifyTypes(
          Array.from(instantiations.get(key.name)) [0] [1].value,
          value,
          lamIndex,
          argIndex,
          {tvid, instantiations: new Map(), aliases, intros: []},
          paramAnno,
          argAnno,
          funAnno,
          argAnnos);
      }

      catch (e) {
        throw new TypeError(cat(
          `cannot instantiate "${key.name}" with "${serializeAst(value)}"\n`,
          `because "${key.name}" is already instantiated with `,
          `"${serializeAst(Array.from(instantiations.get(key.name)) [0] [1].value)}"\n`,
          "while unifying\n",
          `${paramAnno}\n`,
          `${argAnno}\n`,
          extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));        
      }
  }

  instantiations = setNestedMap(
    key.name, `${key.name} ~ ${serializeAst(value)}`, {key, value, substitutor})
      (instantiations);

  return {instantiations, aliases};
};


const escapeCheck = (rigid, meta, instantiations, intros, aliases, history, lamIndex, argIndex, paramAnno, argAnno, funAnno, argAnnos) => {

  let iterRigid = null, iterMeta = null;

  // traverse the introduction list

  for (let i = 0; i < intros.length; i ++) {
    const m = intros[i];

    // persist the index if rigid TV is a member of the current introduction

    if (m.has(rigid.name))
      iterRigid = i;

    // persist the index if meta TV is a member of the current introduction

    if (m.has(meta.name))
      iterMeta = i;
  }

  if ((iterRigid === null && iterMeta === null)
    || (iterRigid === null && iterMeta !== null)
    || (iterRigid !== null && iterMeta === null))
      throw new TypeError(
        "internal error: one or both involved TVs are not member of any introduction");

  // rigid TV was introduced later than meta TV

  else if (iterRigid > iterMeta)
    throw new TypeError(cat(
      "escape check failed\n",
      `cannot instantiate "${rigid.name}" with "${meta.name}"\n`,
      "because the latter is bound by a parent scope of the former\n",
      `"${rigid.name}" would escape its scope\n`,
      "while unifying\n",
      `${paramAnno}\n`,
      `${argAnno}\n`,
      extendErrMsg(lamIndex, argIndex, funAnno, argAnnos, instantiations)));

  // rigid TV was introduced earlier or at the same time as TV

  else {

    // check whether meta TV has aliases

    if (aliases.has(meta.name)
      && !history.has(meta.name)) {

        // recursively conduct an escape check on each alias

        aliases.get(meta.name).forEach(([, alias]) =>
          escapeCheck(rigid, alias, instantiations, intros, aliases, history.add(alias.name), lamIndex, argIndex, paramAnno, argAnno, funAnno, argAnnos));
    }
  }
};


/******************************************************************************
*******************************************************************************
*******************************[ SUBSTITUTION ]********************************
*******************************************************************************
******************************************************************************/


/* Substitute type variables for their instantiated types. The following
substitutions are legal:

meta TV ~ Type
meta TV ~ meta TV
meta TV ~ rigit TV
rigit TV ~ mete TV
rigit TV ~ rigid TV */

const substitute = (ast, instantiations) => {
  let anno = serializeAst(ast), anno_;

  /* Iteratively performs substitution until the result type doesn't deviate
  from the original annotation anymore. */

  do {
    let codomainRefs = [];
    anno_ = anno;

    instantiations.forEach(m => {

      // only the first entry must be taken into account

      const [, {key, value, substitutor}] = Array.from(m) [0];

      // check whether the key isn't a TV

      if (!isTV(key))
       throw new TypeError(
         "internal error: only type variables can be substituted");

      /* If both key and value of the substitution are TVs and the former is in
      codomain position, then the latter must also be in codomain position, so
      that the possible substitution with a function type omit the parenthesis. */

      else if (isTV(value)
        && key.position === "codomain"
        && value.position === "")
          value.position = key.position;

      // substitute each matching element of the AST

      ast = mapAst(ast_ => {

        // each AST element class decides how substitution works in its context

        ast_ = substitutor(ast_, key, value);

        /* If the mapping process runs into a `Codomain` AST element, it must
        convert it back into a regular `Fun`, because `Codomain` only denotes a
        placeholder that has already served its purpose at this point. In other
        words: `Codomain` must not leak into the caller's side. */

        if (ast_[TAG] === "Codomain") {
          ast_ = Fun(
            ast_.body.slice(0, -1),
            ast_.body[ast_.body.length - 1]);

          return ast_;
        }

        else if (ast_[TAG] === "Fun") {

          /* An `Codmain` AST element with `Fun` as its immediate parent must
          be referenced, so that it can be merged with its parent element
          afterwards. The merging is deferred and thus seperated from the
          mapping, because it changes the shape of the mapped AST in place. */

          if (ast_.body.result[TAG] === "Codomain")
            codomainRefs.push(ast_);

          return ast_;
        }

        else return ast_;
      }) (ast);

      /* Merge functions that substituted a TV in codomain position with its
      surrounding function to avoid redundant parenthesis. */

      codomainRefs.forEach(ref => {
        ref.body.lambdas.push(...ref.body.result.body.slice(0, -1));
        ref.body.result = ref.body.result.body[ref.body.result.body.length - 1];
      });

      codomainRefs = [];
    });

    anno = serializeAst(ast);
  } while (anno !== anno_);

  return ast;
};


/******************************************************************************
*******************************************************************************
**********************[ SPECIALIZATION/REGENERALIZATION ]**********************
*******************************************************************************
******************************************************************************/


/* Specialization is the process of instantiating bound TVs with fresh meta or
rigid TVs by giving them a fresh unique name without altering their scopes
(alpha renaming). Specialization only affects the top-level quantifier. Nested
quantifiers can be accessed using subsumption. scriptum only allows nested
quantifiers and thus impredicative polymorphism at the LHS of function types.
Whether bound TVs are meta- or skolem-ized depends on the side of the
subsumption judgement they are located in:

The function application `f(x)` is type safe if `x <: p` holds.

In the above judgment `<:` denotes "is subtype of"/"is at least as polymorphic as",
`x` is an argument type and `p` is f's type parameter. All top-level bound TVs on
the LHS are meta-ized and on the RHS are skolem-ized. */

const specialize = Cons => (intro, scope, tvid = "") => ast => {
  const alphaRenamings = new Map(),
    uniqueNames = new Set();
  
  let charCode = letterA;

  return {
    ast: mapAst(ast_ => {
      if (ast_[TAG] === "Forall") {

        /* Replace the `Forall` quantifier with an `Forall` function type boundary,
        i.e. one without bound TVs and scope. */

        if (scope === ast_.scope)
          return Forall(new Set(), ".", ast_.body);

        // ignore all other `Forall` elements

        else return ast_;
      }

      else if (ast_[TAG] === "BoundTV") {

        // TV scope matches the sought scope

        if (scope === ast_.scope) {

          let name;
          
          // original name is already alpha-renamed

          if (alphaRenamings.has(`${scope}/${ast_.name}`))
            name = alphaRenamings.get(`${scope}/${ast_.name}`);

          else {

            // remove possible trailing digits
            
            name = ast_.name.replace(/\d+$/, "");

            // name collision

            if (uniqueNames.has(name + tvid)) {

              // determine next unused letter

              do {
                if (charCode > 122)
                  throw new TypeError(
                    "internal error: type variable name upper bound exceeded");

                else name = String.fromCharCode(charCode++);
              } while (uniqueNames.has(name + tvid));

              name += tvid;
              alphaRenamings.set(`${scope}/${ast_.name}`, name);
              uniqueNames.add(name);
            }

            // no name collision

            else {
              name += tvid;
              alphaRenamings.set(`${scope}/${ast_.name}`, name);
              uniqueNames.add(name);
            }
          }

          const r = Cons(
            name, ast_.scope, ast_.position, ast_.body);

          // store introduction of TV

          intro.set(r.name, r);
          
          return r;
        }

        // TV scope doesn't match the sought scope

        else return ast_;
      }

      // neither `Scope` nor `BoundTV`

      else return ast_;
    }) (ast),
    intro};
};


const specializeLHS = specialize(MetaTV);


const specializeRHS = specialize(RigidTV);


// remove alpha renamings

const prettyPrint = ast => {
  const alphaRenamings = new Map(),
    uniqueNames = new Set();

  let charCode = letterA;

  return mapAst(ast_ => {
    switch (ast_[TAG]) {
      case "BoundTV": {

        // original name is already restored

        if (alphaRenamings.has(`${ast_.scope}:${ast_.name}`))
          return BoundTV(
            alphaRenamings.get(`${ast_.scope}:${ast_.name}`), ast_.scope, ast_.position, ast_.body);

        // remove trailing digits

        let name = ast_.name.replace(/\d+$/, "");

        // name collision

        if (uniqueNames.has(name)) {

          // find next unused letter

          do {
            if (charCode > 122)
              throw new TypeError(
                "internal error: type variable name upper bound exceeded");

            name = String.fromCharCode(charCode++);
          } while (uniqueNames.has(name));
        }

        alphaRenamings.set(`${ast_.scope}:${ast_.name}`, name);
        uniqueNames.add(name);

        return BoundTV(
          name, ast_.scope, ast_.position, ast_.body);
      }

      case "Forall": {

        // adapt bound TV names listed at the quantifier to the new names

        const btvs = new Set();

        ast_.btvs.forEach((btv) => {
          btvs.add(alphaRenamings.get(`${ast_.scope}:${btv}`));
        });

        return Forall(
          btvs,
          ast_.scope,
          ast_.body)
      }

      default: return ast_;
    }
  }) (ast);
};


/******************************************************************************
*******************************************************************************
************************[ PERSISTENT DATA STRUCTURES ]*************************
*******************************************************************************
******************************************************************************/


/* scriptum comprises a balanced tree implementation based on a left-leaning
red/black tree, which is itself untyped to gain flexibility for some use cases.
It is strongly encouraged to fully type the persistent data structures based
upon it, so that type saftey is not hampered. */


/***[ Constants ]*************************************************************/


const RED = true;
const BLACK = false;


/***[ Constructors ]**********************************************************/


const Leaf = {[Symbol.toStringTag]: "Leaf"};


const Node = (c, h, l, k, v, r) =>
  ({[Symbol.toStringTag]: "Node", c, h, l, k, v, r});


const singleton = (k, v) =>
  Node(BLACK, 1, Leaf, k, v, Leaf);


/***[ Auxiliary Functions ]***************************************************/


const balanceL = (c, h, l, k, v, r) => {
  if (c === BLACK
    && l[TAG] === "Node"
    && l.c ===RED
    && l.l[TAG] === "Node"
    && l.l.c === RED)
      return Node(
        RED, h + 1, turnB(l.l), l.k, l.v, Node(BLACK, h, l.r, k, v, r));

  else return Node(c, h, l, k, v, r);
};


const balanceR = (c, h, l, k, v, r) => {
  if (c === BLACK
    && l[TAG] === "Node"
    && r[TAG] === "Node"
    && l.c === RED
    && r.c === RED)
      return Node(
        RED, h + 1, turnB(l), k, v, turnB(r));

  else if (r[TAG] === "Node"
    && r.c === RED)
      return Node(
        c, h, Node(RED, r.h, l, k, v, r.l), r.k, r.v, r.r);

  else return Node(c, h, l, k, v, r);
};


const isBLB = t =>
  t[TAG] === "Node"
    && t.c === BLACK
    && (t.l[TAG] === "Leaf" || t.l.c === BLACK)
      ? true : false;


const isBLR = t =>
  t[TAG] === "Node"
    && t.c === BLACK
    && t.l[TAG] === "Node"
    && t.l.c === RED
      ? true : false;


const rotateR = t => {
  if (t[TAG] === "Node"
    && t.l[TAG] === "Node"
    && t.l.c === RED)
      return balanceR(
        t.c, t.h, t.l.l, t.l.k, t.l.v, delMax_(Node(RED, t.h, t.l.r, t.k, t.v, t.r)));

  else throw new TypeError("unexpected branch");
};


const turnR = ({[TAG]: type, h, l, k, v, r}) => {
  if (type === "Leaf")
    throw new TypeError("leaves cannot turn color");

  else return Node(
    RED, h, l, k, v, r);
};


const turnB = ({[TAG]: type, h, l, k, v, r}) => {
  if (type === "Leaf")
    throw new TypeError("leaves cannot turn color");

  else return Node(
    BLACK, h, l, k, v, r);
};


const turnB_ = t => {
  switch (t[TAG]) {
    case "Leaf": return Leaf;
    case "Node": return Node(BLACK, t.h, t.l, t.k, t.v, t.r);
    default: throw new TypeError("invalid value constructor");
  }
}


/***[ Deletion ]**************************************************************/


const del = (t, k, cmp) => {
  switch (t[TAG]) {
    case "Leaf": return Leaf;
    
    case "Node": {
      const t_ = del_(turnR(t), k, cmp);

      switch (t_[TAG]) {
        case "Leaf": return Leaf;
        case "Node": return turnB(t_);
        default: throw new TypeError("invalid value constructor");
      }
    }

    default: throw new TypeError("invalid value constructor");
  }
};


const del_ = (t, k, cmp) => {
  switch (t[TAG]) {
    case "Leaf": return Leaf;

    case "Node": {
      switch (cmp(k, t.k)) {
        case LT: return delLT(k, t.c, t.h, t.l, t.k, t.v, t.r, cmp);
        case EQ: return delEQ(k, t.c, t.h, t.l, t.k, t.v, t.r, cmp);
        case GT: return delGT(k, t.c, t.h, t.l, t.k, t.v, t.r, cmp);
        default: throw new TypeError("invalid comparator");
      }
    }

    default: throw new TypeError("invalid value constructor");
  }
};


const delLT = (k, c, h, l, k_, v_, r, cmp) => {
  if (c === RED
    && isBLB(l)
    && isBLR(r))
      return Node(
        RED,
        h,
        Node(BLACK, r.h, del_(turnR(l), k, cmp), k_, v_, r.l.l),
        r.l.k,
        r.l.v,
        Node(BLACK, r.h, r.l.r, r.k, r.v, r.r));

  else if (c === RED
    && isBLB(l))
      return balanceR(
        BLACK, h - 1, del_(tunrR(l), k, cmp), k_, v_, turnR(r));

  else return Node(c, h, del_(l, k, cmp), k_, v_, r);
};


const delEQ = (k, c, h, l, k_, v_, r, cmp) => {
  if (c === RED
    && l[TAG] === "Leaf"
    && r[TAG] === "Leaf")
      return Leaf;

  else if (l[TAG] === "Node"
    && l.c === RED)
      return balanceR(
        c, h, l.l, l.k, l.v, del_(Node(RED, h, l.r, k_, v_, r), k, cmp));

  else if (c === RED
    && isBLB(r)
    && isBLR(l))
      return balanceR(
        RED,
        h,
        turnB(l.l),
        l.k,
        l.v,
        balanceR(BLACK, l.h, l.r, ...min(r), delMin_(turnR(r))));

  else if (c === RED
    && isBLB(r))
      return balanceR(BLACK, h - 1, turnR(l), ...min(r), delMin_(turnR(r)));

  else if (c === RED
    && r[TAG] === "Node"
    && r.c === BLACK)
      return Node(
        RED, h, l, ...min(r), Node(BLACK, r.h, delMin_(r.l), r.k, r.v, r.r));

  else throw new TypeError("unexpected branch");
};


const delGT = (k, c, h, l, k_, v_, r, cmp) => {
  if (l[TAG] === "Node"
    && l.c === RED)
      return balanceR(
        c, h, l.l, l.k, l.v, del_(Node(RED, h, l.r, k_, v_, r)), k, cmp);

  else if (c === RED
    && isBLB(r)
    && isBLR(l))
      return Node(
        RED,
        h,
        turnB(l.l),
        l.k,
        l.v,
        balanceR(BLACK, l.h, l.r, k_, v_, del_(turnR(r), k, cmp)));

  else if (c === RED
    && isBLB(r))
      return balanceR(
        BLACK, h - 1, turnR(l), k_, v_, del_(turnR(r), k, cmp));

  else if (c === RED)
    return Node(RED, h, l, k_, v_, del_(r, k, cmp));

  else throw new TypeError("unexpected branch");
};


/***[ Getter ]****************************************************************/


const get = (t, k, cmp) => {
  switch (t[TAG]) {
    case "Leaf": return null;

    case "Node": {
      switch (cmp(k, t.k)) {
        case LT: return get(t.l, k, cmp);
        case EQ: return t.v;
        case GT: return get(t.r, k, cmp);
        default: throw new TypeError("invalid comparator");
      }
    }

    default: TypeError("invalid value constructor");
  }
};


const has = (t, k, cmp) => {
  switch (t[TAG]) {
    case "Leaf": return false;

    case "Node": {
      switch (cmp(k, t.k)) {
        case LT: return has(t.l, k, cmp);
        case EQ: return true;
        case GT: return has(t.r, k, cmp);
        default: throw new TypeError("invalid comparator");
      }
    }

    default: TypeError("invalid value constructor");
  }
};


/***[ Setter ]****************************************************************/


const set = (t, k, v, cmp) =>
  turnB(set_(t, k, v, cmp));


const set_ = (t, k, v, cmp) => {
  switch (t[TAG]) {
    case "Leaf":
      return Node(RED, 1, Leaf, k, v, Leaf);

    case "Node": {
      switch (cmp(k, t.k)) {
        case LT: return balanceL(
          t.c, t.h, set_(t.l, k, v, cmp), t.k, t.v, t.r);

        case EQ: return Node(t.c, t.h, t.l, k, v, t.r);

        case GT: return balanceR(
          t.c, t.h, t.l, t.k, t.v, set_(t.r, k, v, cmp));

        default: throw new TypeError("invalid comparator");
      }
    }

    default: TypeError("invalid value constructor");
  }
};


/***[ Minimum/Maximum ]*******************************************************/


const min = t => {
  if (t[TAG] === "Node"
    && t.l[TAG] === "Leaf")
      return [t.k, t.v];

  else if (t[TAG] === "Node")
    return min(t.l);

  else throw new TypeError("unexpected Leaf");
};


const delMin = t =>{
  switch (t[TAG]) {
    case "Leaf": return Leaf;

    case "Node": {
      const t_ = delMin_(turnR(t));

      switch (t_[TAG]) {
        case "Leaf": return Leaf;
        case "Node": return turnB(t_);
        default: throw new TypeError("invalid value constructor");
      }
    }

    default: throw new TypeError("invalid value constructor");
  }
};


const delMin_ = t => {
  if (t[TAG] === "Node"
    && t.c === RED
    && t.l[TAG] === "Leaf"
    && t.r[TAG] === "Leaf")
      return Leaf;

  else if (t[TAG] === "Node"
    && t.c === RED)
      return Node(RED, t.h, delMin_(t.l), t.k, t.v, t.r);

  else if (t[TAG] === "Node"
    && isBLB(t.l)
    && isBLR(t.r))
      return delMin__(t);

  else if (t[TAG] === "Node"
    && isBLB((t.l)))
      return balanceR(
        BLACK, t.h - 1, delMin_(turnR(t.l)), t.k, t.v, turnR(t.r));

  else if (t[TAG] === "Node"
    && t.l[TAG] === "Node"
    && t.l.c === BLACK)
      return Node(
        RED, t.h, Node(BLACK, t.l.h, delMin_(t.l.l), t.l.k, t.l.v, t.l.r), t.k, t.v, t.r);

  else throw new TypeError("unexpected branch");
};


const delMin__ = t => {
  if(t[TAG] === "Node"
    && t.c === RED
    && t.r[TAG] === "Node"
    && t.r.c === BLACK
    && t.r.l[TAG] === "Node"
    && t.r.l.c === RED)
      return Node(
        RED,
        t.h,
        Node(BLACK, t.r.h, delMin_(turnR(t.l)), t.k, t.v, t.r.l.l),
        t.r.l.k,
        t.r.l.v,
        Node( BLACK, t.r.h, t.r.l.r, t.r.k, t.r.v, t.r.r));

  else throw new TypeError("unexpected branch");
};


const max = t => {
  if (t[TAG] === "Node"
    && t.r[TAG] === "Leaf")
      return [t.k, t.v];

  else if (t[TAG] === "Node")
    return max(t.r);

  else throw new TypeError("unexpected Leaf");
};


const delMax = t => {
  switch (t[TAG]) {
    case "Leaf": return Leaf;

    case "Node": {
      const t_ = delMax_(turnR(t));

      switch (t_[TAG]) {
        case "Leaf": return Leaf;
        case "Node": return turnB(t_);
        default: TypeError("invalid value constructor");
      }
    }

    default: TypeError("invalid value constructor");
  }
};


const delMax_ = t => {
  if (t[TAG] === "Node"
    && t.c === RED
    && t.l[TAG] === "Leaf"
    && t.r[TAG] === "Leaf")
      return Leaf;

  else if (t[TAG] === "Node"
    && t.c === RED
    && t.l[TAG] === "Node"
    && t.l.c === RED)
      return rotateR(t);

  else if (t[TAG] === "Node"
    && t.c === RED
    && isBLB(t.r)
    && isBLR(t.l))
      return delMax__(t);

  else if (t[TAG] === "Node"
    && t.c === RED
    && isBLB(t.r))
      return balanceR(
        BLACK, t.h - 1, turnR(t.l), t.k, t.v, delMax_(turnR(t.r)));

  else if (t[TAG] === "Node"
    && t.c === RED)
      return Node(RED, t.h, t.l, t.k, t.v, rotateR(t.r));

  else throw new TypeError("unexpected branch");
};


const delMax__ = t => {
  if (t[TAG] === "Node"
    && t.c === RED
    && t.l[TAG] === "Node"
    && t.l.c === BLACK
    && t.l.l[TAG] === "Node"
    && t.l.l.c === RED)
      return Node(
        RED, t.h, turnB(t.l.l), t.l.k, t.l.v, balanceR(BLACK, t.l.h, t.l.r, t.k, t.v, delMax_(turnR(t.r))));

  else throw new TypeError("unexpected branch");
};


/***[ Set Operations ]********************************************************/


const join = (t1, t2, k, v, cmp) => {
  if (t1[TAG] === "Leaf")
    return set(t2, k, v, cmp);

  else if (t2[TAG] === "Leaf")
    return set(t1, k, v, cmp);

  else {
    switch (cmp(t1.h, t2.h)) {
      case LT: return turnB(joinLT(t1, t2, k, v, t1.h, cmp));
      case EQ: return Node(BLACK, t1.h + 1, t1, k, v, t2);
      case GT: return turnB(joinGT(t1, t2, k, v, t2.h, cmp));
      default: throw new TypeError("invalid comparator");
    }
  }
};


const joinLT = (t1, t2, k, v, h1, cmp) => {
  if (t2[TAG] === "Node"
    && t2.h === h1)
      return Node(RED, t2.h + 1, t1, k, v, t2);

  else if (t2[TAG] === "Node")
    return balanceL(t2.c, t2.h, joinLT(t1, t2.l, k, v, h1, cmp), t2.k, t2.v, t2.r);

  else throw new TypeError("unexpected leaf");
};


const joinGT = (t1, t2, k, v, h2, cmp) => {
  if (t1[TAG] === "Node"
    && t1.h === h2)
      return Node(RED, t1.h + 1, t1, k, v, t2);

  else if (t1[TAG] === "Node")
    return balanceR(t1.c, t1.h, t1.l, t1.k, t1.v, joinGT(t1.r, t2, k, v, h2, cmp));

  else throw new TypeError("unexpected leaf");
};


const merge = (t1, t2, cmp) => {
  if (t1[TAG] === "Leaf")
    return t2;

  else if (t2[TAG] === "Leaf")
    return t1;

  else {
    switch (cmp(t1.h, t2.h)) {
      case LT: return turnB(mergeLT(t1, t2, t1.h, cmp));
      case EQ: return turnB(mergeEQ(t1, t2, cmp));
      case GT: return turnB(mergeGT(t1, t2, t2.h, cmp));
      default: throw new TypeError("invalid comparator");
    }
  }
};


const mergeLT = (t1, t2, h1, cmp) => {
  if (t2[TAG] === "Node"
    && t2.h === h1)
      return mergeEQ(t1, t2, cmp);

  else if (t2[TAG] === "Node")
    return balanceL(t2.c, t2.h, mergeLT(t1, t2.l, h1, cmp), t2.k, t2.v, t2.r);

  else throw new TypeError("unexpected leaf");
};


const mergeEQ = (t1, t2, cmp) => {
  if (t1[TAG] === "Leaf"
    && t2[TAG] === "Leaf")
      return Leaf;

  else if (t1[TAG] === "Node") {
    const t2_ = delMin(t2),
      [k, v] = min(t2);

    if (t1.h === t2_.h)
      return Node(RED, t1.h + 1, t1, k, v, t2_);

    else if (t1.l[TAG] === "Node"
      && t1.l.c === RED)
        return Node(
          RED, t1.h + 1, turnB(t1.l), t1.k, t1.v, Node(BLACK, t1.h, t1.r, k, v, t2_));

    else return Node(
      BLACK, t1.h, turnR(t1), k, v, t2_);
  }

  else throw new TypeError("unexpected branch");
};


const mergeGT = (t1, t2, h2, cmp) => {
  if (t1[TAG] === "Node"
    && t1.h === h2)
      return mergeEQ(t1, t2, cmp);

  else if (t1[TAG] === "Node")
    return balanceR(t1.c, t1.h, t1.l, t1.k, t1.v, mergeGT(t1.r, t2, h2, cmp));

  else throw new TypeError("unexpected leaf");
};


const split = (t, k, cmp) => {
  if (t[TAG] === "Leaf")
    return [Leaf, Leaf];

  else {
    switch (cmp(k, t.k)) {
      case LT: {
        const [lt, gt] = split(t.l, k, cmp);
        return [lt, join(gt, t.r, t.k, t.v, cmp)];
      }

      case EQ: return [turnB_(t.l), t.r];

      case GT: {
        const [lt, gt] = split(t.r, k, cmp);
        return [join(t.l, lt, t.k, t.v, cmp), gt];
      }

      default: throw new TypeError("invalid comparator");
    }
  }
};


const union = (t1, t2, cmp) => {
  if (t2[TAG] === "Leaf")
    return t1;

  else if (t1[TAG] === "Leaf")
    return turnB_(t2);

  else {
    const [l, r] = split(t1, t2.k, cmp);
    return join(union(l, t2.l, cmp), union(r, t2.r, cmp), t2.k, t2.v, cmp);
  }
};


const intersect = (t1, t2, cmp) => {
  if (t1[TAG] === "Leaf")
    return Leaf;

  else if (t2[TAG] === "Leaf")
    return Leaf;

  else {
    const [l, r] = split(t1, t2.k, cmp);

    if (has(t1, t2.k, cmp))
      return join(
        intersect(l, t2.l, cmp), intersect(r, t2.r, cmp), t2.k, t2.v, cmp);

    else return merge(
      intersect(l, t2.l, cmp), intersect(r, t2.r, cmp), cmp);
  }
};


const diff = (t1, t2, cmp) => {
  if (t1[TAG] === "Leaf")
    return Leaf;

  else if (t2[TAG] === "Leaf")
    return t1;

  else {
    const [l, r] = split(t1, t2.k, cmp);
    return merge(diff(l, t2.l, cmp), diff(r, t2.r, cmp));
  }
};


/******************************************************************************
*******************************************************************************
***************************[ SAFE IN-PLACE UPDATES ]***************************
*******************************************************************************
******************************************************************************/


/* `Mutable` is an imperative data type that allows in-place updates by encap-
sulating the mutable data inside its data structure. Such mutations can be con-
sidered safe, because `Mutable` prevents you from sharing the effect. The type
enables first class in-place upades but is not composable. */


export const Mutable = fun(
  clone => ref => {
    const anno = CHECK ? introspectDeep({charCode: letterA}) (ref) : "";

    return _let({}, ref).in(fun((o, ref) => {
      let mutated = false;

      o.consume = thunk(() => {
        if (mutated) {
          delete o.update;

          o.update = _ => {
            throw new TypeError(
              "illegal in-place update of consumed data structure");
          };
        }

        return ref;
      }, `() => ${anno}`);

      o.update = fun(k => {
        if (!mutated) {
          ref = clone(ref); // copy once on first write
          mutated = true;
        }

        k(ref); // use the effect but discard the result
        return o;
      }, `(${anno} => ${anno}) => Mutable {consume: ${anno}, update: ((${anno} => ${anno}) => this*)}`);

      return (o[TAG] = "Mutable", o);
    }, `{}, ${anno} => Mutable {consume: ${anno}, update: ((${anno} => ${anno}) => this*)}`));
  },
  "(t<a> => t<a>) => t<a> => Mutable {consume: t<a>, update: ((t<a> => t<a>) => this*)}");


/******************************************************************************
*******************************************************************************
******************************[ LAZY EVALUATION ]******************************
*******************************************************************************
******************************************************************************/


/* Thunks are arbitrary unevaluated expressions that are evaluated when needed.
As opposed to Javascript thunks like `() => expr` scriptum uses implicit thunks,
i.e. you don't have to care whether they are evaluated or not. Thunks enable
proper lazy evaluation in Javascript. Thunks are untyped but you are strongly
encouraged to only use typed lambdas inside. */


/***[ Constants ]*************************************************************/


const EVAL = PREFIX + "eval";


const NULL = PREFIX + "null";


const THUNK = PREFIX + "thunk";


/***[ API ]*******************************************************************/


// strictly evaluate a thunk non-recursively

export const strict = x =>
  x && x[THUNK] ? x[EVAL] : x;


// creates an annotated thunk

export const thunk = (thunk, anno) => {
  if (CHECK) {
    if (anno)
      return new Proxy(thunk, new ThunkProxy(anno));

    else throw new TypeError(
      "missing type annotation");
  }

  else return new Proxy(thunk, new ThunkProxy());
  };


/***[ Implementation ]********************************************************/


class ThunkProxy {
  constructor(anno) {
    this.memo = NULL

    if (CHECK) {

      // thunks are opaque values

      if (anno.search(/\(\) => /) === 0)
        this[ANNO] = anno.replace(/\(\) => /, "");

      else throw new TypeError(cat(
        "thunk expected\n",
        `but "${anno}" received`));
    }
  }

  apply(g, that, args) {

    // evaluate to WHNF

    if (this.memo === NULL) {
      this.memo = g();

      while (this.memo[THUNK] === true)
        this.memo = this.memo[EVAL];
    }

    return this.memo(...args);
  }

  get(g, k) {

    // prevent evaluation
    
    if (k === THUNK)
      return true;

    // prevent evaluation

    else if (k === ANNO)
      return this[ANNO];

    // prevent evaluation

    else if (k === Symbol.toStringTag)
      return "Function";

    // evaluate once

    else if (this.memo === NULL) {
  
      // shallowly evaluate

      if (k === EVAL
        && this.memo === NULL)
          this.memo = g();

      // evaluate to WHNF

      else {
        this.memo = g();

        while (this.memo[THUNK] === true)
          this.memo = this.memo[EVAL];
      }
    }

    // return the memoized result

    if (k === EVAL)
      return this.memo;

    // enforce array spreading
    
    else if (k === Symbol.isConcatSpreadable
      && Array.isArray(this.memo))
        return true;

    // method binding without triggering evaluation

    else if (typeof this.memo[k] === "function"
      && this.memo[k] [THUNK] !== true)
        return this.memo[k].bind(this.memo);

    else return this.memo[k];
  }

  getOwnPropertyDescriptor(g, k) {

    // evaluate to WHNF

    if (this.memo === NULL) {
      this.memo = g();

      while (this.memo[THUNK] === true)
        this.memo = this.memo[EVAL];
    }

    return Reflect.getOwnPropertyDescriptor(this.memo, k);
  }

  has(g, k) {

    // prevent evaluation

    if (k === THUNK)
      return true;

    // prevent evaluation

    else if (CHECK && k === ANNO)
      return true;

    // evaluate to WHNF

    else if (this.memo === NULL) {
      this.memo = g();

      while (this.memo[THUNK] === true)
        this.memo = this.memo[EVAL];
    }

    return k in this.memo;
  }

  ownKeys(g) {

    // evaluate to WHNF

    if (this.memo === NULL) {
      this.memo = g();

      while (this.memo[THUNK] === true)
        this.memo = this.memo[EVAL];
    }

    return Object.keys(this.memo);
  }
}


/******************************************************************************
*******************************************************************************
****************************[ STACK SAFETY (SYNC) ]****************************
*******************************************************************************
******************************************************************************/


/* Trampolines themselves are untyped to provide additional flexibility in some
use cases. Howeverm, they ensure that the provided function argument is typed
to maintain type safety. */


/******************************************************************************
*****************************[ STRICT RECURSION ]******************************
******************************************************************************/


/* `strictRec` enforec the evaluation of huge nested implicit thunks in a stack-
safe manner. */

export const strictRec = x => {
  while (x && x[THUNK] === true)
    x = x[EVAL];

  return x;
};


/******************************************************************************
*****************************[ MONADIC RECURSION ]*****************************
******************************************************************************/


/* Monad recursion enables stack-safe monadic recursive functions. The downside
is that you can only compose this stack safety with other effects if the
trampoline monad is the outermost one in the transformer. */

export const MonadRec = {}; // namespace


MonadRec.loop = o => { // trampoline
  while (o.tag === "Iterate")
    o = o.f(o.x);

  return o.tag === "Return"
    ? o.x
    : _throw(new TypeError("invalid trampoline tag"));
};


/***[ Applicative ]***********************************************************/


MonadRec.ap = tf => tx =>
  MonadRec.chain(tf) (f =>
    MonadRec.chain(tx) (x =>
      MonadRec.of(f(x))));


// MonadRec.of @Derived


/***[ Functor ]***************************************************************/


MonadRec.map = f => tx =>
  MonadRec.chain(tx) (x => MonadRed.of(f(x)));


/***[ Monad ]*****************************************************************/


MonadRec.chain = mx => fm =>
  mx.tag === "Iterate" ? Iterate(mx.x) (y => MonadRec.chain(mx.f(y)) (fm))
    : mx.tag === "Return" ? fm(mx.x)
    : _throw(new TypeError("invalid trampoline tag"));


/***[ Tags ]******************************************************************/


MonadRec.iterate = x => f => {
  if (CHECK && !(ANNO in f))
    throw new TypeError(cat(
      "typed lambda expected\n",
      `but "${f.toString()}" received\n`));

  else {tag: "Iterate", f, x};
}


MonadRec.return = x =>
  ({tag: "Return", x});


/***[ Derived ]***************************************************************/


MonadRec.of = MonadRec.return;


/******************************************************************************
******************************[ TAIL RECURSION ]*******************************
******************************************************************************/


/* ES6 ships with tail call optimization but no major browser vendor has
implemented them yet and probably never will. Therefore we need a trampoline
to eliminate the tail call. */

export const TailRec = {}; // namespace


TailRec.loop = f => {
  if (CHECK && !(ANNO in f))
    throw new TypeError(cat(
      "typed lambda expected\n",
      `but "${f.toString()}" received\n`));

  else return x => {
    let o = f(x);

    while (o.tag === "Iterate")
      o = f(o.x);

    return o.tag === "Return"
      ? o.x
      : _throw(new TypeError("invalid trampoline tag"));
  };
};


/***[ Tags ]******************************************************************/


TailRec.iterate = x => ({tag: "Iterate", x});


TailRec.return = x => ({tag: "Return", x});


/******************************************************************************
*******************************************************************************
***************************[ STACK SAFETY (ASYNC) ]****************************
*******************************************************************************
******************************************************************************/


// see @LIB/Serial


// see @LIB/Parallel


/******************************************************************************
*******************************************************************************
************************************[ LIB ]************************************
*******************************************************************************
******************************************************************************/


/******************************************************************************
**************************[ CROSS-CUTTING CONCERNS ]***************************
******************************************************************************/


export const lazyProp = (o, prop, f) =>
  Object.defineProperty(
    o,
    prop, {
      get: f,
      configurable: true,
      enumerable: true
    });


/******************************************************************************
*******************************[ TYPE CLASSES ]********************************
******************************************************************************/


/* Only type classes with a single type parameter are supported. Superclass
dependencies are listed in alphabetical order. Type class properties must be
unique across classes, due to subclass/superclass relations. */


/***[ Bifunctor ]*************************************************************/


export const Bifunctor = typeClass(`(^a, b, c, d. {
  bimap: ((a => b) => (c => d) => f<a, c> => f<b, d>)
}) => Bifunctor<f>`);


/***[ Bounded ]***************************************************************/


export const Bounded = typeClass(`({
  bottom: a,·
  top: a
}) => Bounded<a>`);


/***[ Clonable ]**************************************************************/


export const Clonable = typeClass(`(^a. {
  clone: (t<a> => t<a>)
}) => Clonable<t>`);


/***[ Contravaraint ]*********************************************************/


export const Contravaraint = typeClass(`(^a, b. {
  cmap: ((b => a) => f<a> => f<b>)
}) => Contravaraint<f>`);


/***[ Enum ]******************************************************************/


let Enum = Option => typeClass(`({
  succ: (a => Option<a>),·
  pred: (a => Option<a>)
}) => Enum<a>`);


/***[ Foldable ]**************************************************************/


let Foldable = Monoid => typeClass(`(^m, a, b. {
  foldl: ((b => a => b) => b => t<a> => b),·
  foldr: ((a => b => b) => b => t<a> => b)
}) => Foldable<t>`);


/***[ Functor ]***************************************************************/


export const Functor = typeClass(`(^a, b. {
  map: ((a => b) => f<a> => f<b>)
}) => Functor<f>`);


/***[ Functor :: Alt ]********************************************************/


export const Alt = typeClass(`Functor<f> => (^a. {
  alt: (f<a> => f<a> => f<a>)
}) => Alt<f>`);


/***[ Functor :: Alt :: Plus ]************************************************/


export const Plus = typeClass(`Alt<f> => (^a. {
  neutral: f<a>
}) => Plus<f>`);


/***[ Functor :: Alt :: Plus :: Alternative ]*********************************/


let Alternative = Applicative => typeClass(
  `Applicative<a>, Plus<a> => ({}) => Alternative<a>`);


/***[ Functor :: Apply ]******************************************************/


export const Apply = typeClass(`Functor<f> => (^a, b. {
  apply: (f<(a => b)> => f<a> => f<b>)
}) => Apply<f>`);


/***[ Functor :: Apply :: Applicative ]***************************************/


export const Applicative = typeClass(`Apply<f> => (^a. {
  of: (a => f<a>)
}) => Applicative<f>`);


/***[ Functor :: Apply :: Chain ]*********************************************/


export const Chain = typeClass(`Apply<m> => (^a, b. {
  chain: (m<a> => (a => m<b>) => m<b>)
}) => Chain<m>`);


/***[ Functor :: Apply :: Chain :: Monad ]************************************/


export const Monad = typeClass(
  `Applicative<m>, Chain<m> => ({}) => Monad<m>`);


/***[ Functor :: Apply :: Chain :: Monad :: MonadPlus ]***********************/


let MonadPlus = Alternative => typeClass(
  `Alternative<m>, Monad<m> => ({}) => MonadPlus<m>`);


/***[ Functor :: Extend ]*****************************************************/


export const Extend = typeClass(`Functor<w> => (^a, b. {
  extend: ((w<a> => b) => w<a> => w<b>)
}) => Extend<w>`);


/***[ Functor :: Extend :: Comonad ]******************************************/


export const Comonad = typeClass(`Extend<w> => (^a. {
  extract: (w<a> => a)
}) => Comonad<w>`);


/***[ Functor :: Filterable ]*************************************************/


let Filterable = (Option, Either) => typeClass(`Functor<f> => (^a, b, l, r. {
  filter: ((a => Booelan) => f<a> => f<a>),·
  filterMap: ((a => Option<b>) => f<a> => f<b>),·
  partition: ((a => Boolean) => f<a> => {false: f<a>, true: f<a>}),·
  partitionMap: ((a => Either<l, r>) => f<a> => {left: f<l>, right: f<r>})
}) => Filterable<f>`);


/***[ Profunctor ]************************************************************/


export const Profunctor = typeClass(`(^a, b, c, d. {
  dimap: ((a => b) => (c => d) => p<b, c> => p<a, d>)
}) => Profunctor<p>`);


/***[ Semigroup ]*************************************************************/


export const Semigroup = typeClass(`({
  append: (a => a => a)
}) => Semigroup<a>`);


/***[ Semigroup :: Monoid ]***************************************************/


export const Monoid = typeClass(`Semigroup<a> => ({
  empty: a
}) => Monoid<a>`);


/***[ Semigroupoid ]**********************************************************/


export const Semigroupoid = typeClass(`(^a, b, c. {
  comp: (t<b, c> => t<a, b> => t<a, c>)
}) => Semigroupoid<t>`);


/***[ Semigroupoid :: Category ]**********************************************/


export const Category = typeClass(`Semigroupoid<t> => (^a, b, c. {
  id: t<a, a>
}) => Category<t>`);


/***[ Semiring ]**************************************************************/


export const Semiring = typeClass(`({
  add: (a => a => a),·
  zero: a,·
  mul: (a => a => a),·
  one: a
}) => Semiring<a>`);


/***[ Semiring :: Ring ]******************************************************/


export const Ring = typeClass(`Semiring<a> => ({
  sub: (a => a => a)
}) => Ring<a>`);


/***[ Semiring :: Ring :: DivisionRig ]***************************************/


export const DivisionRing = typeClass(`Ring<a> => ({
  recip: (a => a)
}) => DivisionRing<a>`);


/***[ Semiring :: Ring :: EuclideanRing ]*************************************/


export const EuclideanRing = typeClass(`Ring<a> => ({
  degree: (a => Integer),·
  div: (a => a => a),·
  mod: (a => a => a)
}) => EuclideanRing<a>`);


/***[ Semiring :: Ring :: EuclideanRing :: Field ]****************************/


export const Field = typeClass(
  `EuclideanRing<a>, DivisionRing<a> => ({}) => Field<a>`);


/***[ Setoid ]****************************************************************/


export const Setoid = typeClass(`({
  eq: (a => a => Boolean),·
  neq: (a => a => Boolean)
}) => Setoid<a>`);


/***[ Setoid :: Order ]*******************************************************/


export const Order = typeClass(`Setoid<a> => ({
  compare: (a => a => Comparator)
}) => Order<a>`);


/***[ Traversable ]***********************************************************/


let Traversable = Foldable => typeClass(`Foldable<t>, Functor<t>, Applicative<f> => (^a, b, f. {
  mapA: ((a => f<b>) => t<a> => f<t<b>>),·
  seqA: (t<f<a>> => f<t<a>>)
}) => Traversable<t>`);


/***[ Dependent ]*************************************************************/


Alternative = Alternative(Applicative);
export {Alternative};


Foldable = Foldable(Monoid);
export {Foldable};


MonadPlus = MonadPlus(Alternative);
export {MonadPlus};


Traversable = Traversable(Foldable);
export {Traversable};


/******************************************************************************
***********************[ AD-HOC POLYMORPHIC FUNCTIONS ]************************
******************************************************************************/


export const appEff1 = fun(
  Apply => tx => ty =>
    Apply.apply(Apply.map(_const) (tx)) (ty),
  "Apply<f> => f<a> => f<b> => f<a>");


export const appEff2 = fun(
  Apply => tx => ty =>
    Apply.apply(mapEff(Apply.Functor) (id) (tx)) (ty),
  "Apply<f> => f<a> => f<b> => f<b>");


// based on an eager left-associative fold

export const foldMap = fun(
  ({foldl}, {append, empty}) => f => foldl(comp2nd(append) (f)) (empty),
  "Foldable<t>, Monoid<m> => (a => m) => t<a> => m");


// based on a lazy right-associative fold

export const foldMap_ = fun(
  ({foldr}, {append, empty}) => f => foldr(comp(append) (f)) (empty),
  "Foldable<t>, Monoid<m> => (a => m) => t<a> => m");


export const mapEff = fun(
  Functor => x => Functor.map(fun(_ => x, "a => b")),
  "Functor<f> => a => f<b> => f<a>");


/******************************************************************************
*********************************[ FUNCTION ]**********************************
******************************************************************************/


export const F = {}; // namespace


/***[ Applicator ]************************************************************/


export const app = fun(
  f => x => f(x),
  "(a => b) => a => b");


export const app_ = fun(
  x => f => f(x),
  "a => (a => b) => b");


// partially apply right argument

export const appr = fun(
  (f, y) => x => f(x) (y),
  "(a => b => c), b => a => c");


export const flip = fun(
  f => y => x => f(x) (y),
  "(a => b => c) => b => a => c");


export const infix = fun(
  (x, f, y) => f(x) (y),
  "a, (a => b => c), b => c");


export const infix2 = fun(
  (x, f, y, g, z) => g(f(x) (y)) (z),
  "a, (a => b => c), b, (c => d => e), d => e");


export const infix2_ = fun(
  (x, f, y, g, z) => g(x) (f(y) (z)),
  "a, (a => b => c), b, (c => d => e), d => e");


export const infix3 = fun(
  (w, f, x, g, y, h, z) => h(g(f(w) (x)) (y)) (z),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f => g");


export const infix3_ = fun(
  (w, f, x, g, y, h, z) => h(w) (g(x) (f(y) (z))),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f => g");


export const infix4 = fun(
  (v, f, w, g, x, h, y, i, z) => i(h(g(f(v) (w)) (x)) (y)) (z),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h => i");


export const infix4_ = fun(
  (v, f, w, g, x, h, y, i, z) => i(v) (h(w) (g(x) (f(y) (z)))),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h => i");


export const infix5 = fun(
  (u, f, v, g, w, h, x, i, y, j, z) => j(i(h(g(f(u) (v)) (w)) (x)) (y)) (z),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j => k");


export const infix5_ = fun(
  (u, f, v, g, w, h, x, i, y, j, z) => j(u) (i(v) (h(w) (g(x) (f(y) (z))))),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j => k");


export const infix6 = fun(
  (t, f, u, g, v, h, w, i, x, j, y, k, z) => k(j(i(h(g(f(t) (u)) (v)) (w)) (x)) (y)) (z),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l => m");


export const infix6_ = fun(
  (t, f, u, g, v, h, w, i, x, j, y, k, z) => k(t) (j(u) (i(v) (h(w) (g(x) (f(y) (z)))))),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l => m");


export const infix7 = fun(
  (s, f, t, g, u, h, v, i, w, j, x, k, y, l, z) => l(k(j(i(h(g(f(s) (t)) (u)) (v)) (w)) (x)) (y)) (z),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n => o");


export const infix7_ = fun(
  (s, f, t, g, u, h, v, i, w, j, x, k, y, l, z) => l(s) (k(t) (j(u) (i(v) (h(w) (g(x) (f(y) (z))))))),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n => o");


export const infix8 = fun(
  (r, f, s, g, t, h, u, i, v, j, w, k, x, l, y, m, z) => m(l(k(j(i(h(g(f(r) (s)) (t)) (u)) (v)) (w)) (x)) (y)) (z),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n, (o => p => q), p => q");


export const infix8_ = fun(
  (r, f, s, g, t, h, u, i, v, j, w, k, x, l, y, m, z) => m(r) (l(s) (k(t) (j(u) (i(v) (h(w) (g(x) (f(y) (z)))))))),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n, (o => p => q), p => q");


export const infix9 = fun(
  (q, f, r, g, s, h, t, i, u, j, v, k, w, l, x, m, y, n, z) => n(m(l(k(j(i(h(g(f(q) (r)) (s)) (t)) (u)) (v)) (w)) (x)) (y)) (z),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n, (o => p => q), p, (q => r => s), r => s");


export const infix9_ = fun(
  (q, f, r, g, s, h, t, i, u, j, v, k, w, l, x, m, y, n, z) => n(q) (m(r) (l(s) (k(t) (j(u) (i(v) (h(w) (g(x) (f(y) (z))))))))),
  "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n, (o => p => q), p, (q => r => s), r => s");


// mimic overloaded infix operations (left associative)

export const infixn = (...args) => {
  switch (args.length) {
    case 5: return fun(
      args[3] (args[1] (args[0]) (args[2])) (args[4]),
      "a, (a => b => c), b, (c => d => e), d => e");

    case 7: return fun(
      args[5] (args[3] (args[1] (args[0]) (args[2])) (args[4])) (args[6]),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f => g");

    case 9: return fun(
      args[7] (args[5] (args[3] (args[1] (args[0]) (args[2])) (args[4])) (args[6])) (args[8]),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h => i");

    case 11: return fun(
      args[9] (args[7] (args[5] (args[3] (args[1] (args[0]) (args[2])) (args[4])) (args[6])) (args[8])) (args[10]),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j => k");

    case 13: return fun(
      args[11] (args[9] (args[7] (args[5] (args[3] (args[1] (args[0]) (args[2])) (args[4])) (args[6])) (args[8])) (args[10])) (args[12]),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l => m");

    case 15: return fun(
      args[13] (args[11] (args[9] (args[7] (args[5] (args[3] (args[1] (args[0]) (args[2])) (args[4])) (args[6])) (args[8])) (args[10])) (args[12])) (args[14]),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n => o");

    case 17: return fun(
      args[15] (args[13] (args[11] (args[9] (args[7] (args[5] (args[3] (args[1] (args[0]) (args[2])) (args[4])) (args[6])) (args[8])) (args[10])) (args[12])) (args[14])) (args[16]),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n, (o => p => q), p => q");

    case 19: return fun(
      args[17] (args[15] (args[13] (args[11] (args[9] (args[7] (args[5] (args[3] (args[1] (args[0]) (args[2])) (args[4])) (args[6])) (args[8])) (args[10])) (args[12])) (args[14])) (args[16])) (args[18]),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n, (o => p => q), p, (q => r => s), r => s");
  }
};


// mimic overloaded infix operations (right associative)

export const infixn_ = (...args) => {
  switch (args.length) {
    case 5: return fun(
      args[3] (args[0]) (args[1] (args[2]) (args[4])),
      "a, (a => b => c), b, (c => d => e), d => e");

    case 7: return fun(
      args[5] (args[0]) (args[3] (args[2]) (args[1] (args[4]) (args[6]))),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f => g");

    case 9: return fun(
      args[7] (args[0]) (args[5] (args[2]) (args[3] (args[4]) (args[1] (args[6]) (args[8])))),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h => i");

    case 11: return fun(
      args[9] (args[0]) (args[7] (args[2]) (args[5] (args[4]) (args[3] (args[6]) (args[1] (args[8]) (args[10]))))),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j => k");

    case 13: return fun(
      args[11] (args[0]) (args[9] (args[2]) (args[7] (args[4]) (args[5] (args[6]) (args[3] (args[8]) (args[1] (args[10]) (args[12])))))),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l => m");

    case 15: return fun(
      args[13] (args[0]) (args[11] (args[2]) (args[9] (args[4]) (args[7] (args[6]) (args[5] (args[8]) (args[3] (args[10]) (args[1] (args[12]) (args[14]))))))),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n => o");

    case 17: return fun(
      args[15] (args[0]) (args[13] (args[2]) (args[11] (args[4]) (args[9] (args[6]) (args[7] (args[8]) (args[5] (args[10]) (args[3] (args[12]) (args[1] (args[14]) (args[16])))))))),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n, (o => p => q), p => q");

    case 19: return fun(
      args[17] (args[0]) (args[15] (args[2]) (args[13] (args[4]) (args[11] (args[6]) (args[9] (args[8]) (args[7] (args[10]) (args[5] (args[12]) (args[3] (args[14]) (args[1] (args[16]) (args[18]))))))))),
      "a, (a => b => c), b, (c => d => e), d, (e => f => g), f, (g => h => i), h, (i => j => k), j, (k => l => m), l, (m => n => o), n, (o => p => q), p, (q => r => s), r => s");
  }
};


/***[ Anonymous Recursion ]***************************************************/


export const fix = fun(
  f => x => f(fix(f)) (x),
  "((a => b) => a => b) => a => b");


export const fix_ = fun(
  f => f(thunk(() => fix_(f), "() => a => a")),
  "(a => a) => a");


/***[ Category ]**************************************************************/


export const comp = fun(
  f => g => x => f(g(x)),
  "(b => c) => (a => b) => a => c");


export const comp3 = fun(
  f => g => h => x => f(g(h(x))),
  "(c => d) => (b => c) => (a => b) => a => d");


export const comp4 = fun(
  f => g => h => i => x => f(g(h(i(x)))),
  "(d => e) => (c => d) => (b => c) => (a => b) => a => e");


export const comp5 = fun(
  f => g => h => i => j => x => f(g(h(i(j(x))))),
  "(e => f) => (d => e) => (c => d) => (b => c) => (a => b) => a => f");


export const comp6 = fun(
  f => g => h => i => j => k => x => f(g(h(i(j(k(x)))))),
  "(f => g) => (e => f) => (d => e) => (c => d) => (b => c) => (a => b) => a => g");


export const comp7 = fun(
  f => g => h => i => j => k => l => x => f(g(h(i(j(k(l(x))))))),
  "(g => h) => (f => g) => (e => f) => (d => e) => (c => d) => (b => c) => (a => b) => a => h");


export const comp8 = fun(
  f => g => h => i => j => k => l => m => x => f(g(h(i(j(k(l(m(x)))))))),
  "(h => i) => (g => h) => (f => g) => (e => f) => (d => e) => (c => d) => (b => c) => (a => b) => a => i");


export const comp9 = fun(
  f => g => h => i => j => k => l => m => n => x => f(g(h(i(j(k(l(m(n(x))))))))),
  "(i => j) => (h => i) => (g => h) => (f => g) => (e => f) => (d => e) => (c => d) => (b => c) => (a => b) => a => j");


// mimic overloaded composition function

export const compn = (...fs) => x => {
  switch (fs.length) {
    case 2: return fun(
      fs[0] (fs[1] (x)),
      "(b => c) => (a => b) => a => c");

    case 3: return fun(
      fs[0] (fs[1] (fs[2] (x))),
      "(c => d) => (b => c) => (a => b) => a => d");

    case 4: return fun(
      fs[0] (fs[1] (fs[2] (fs[3] (x)))),
      "(d => e) => (c => d) => (b => c) => (a => b) => a => e");

    case 5: return fun(
      fs[0] (fs[1] (fs[2] (fs[3] (fs[4] (x))))),
      "(e => f) => (d => e) => (c => d) => (b => c) => (a => b) => a => f");

    case 6: return fun(
      fs[0] (fs[1] (fs[2] (fs[3] (fs[4] (fs[5] (x)))))),
      "(f => g) => (e => f) => (d => e) => (c => d) => (b => c) => (a => b) => a => g");

    case 7: return fun(
      fs[0] (fs[1] (fs[2] (fs[3] (fs[4] (fs[5] (fs[6] (x))))))),
      "(g => h) => (f => g) => (e => f) => (d => e) => (c => d) => (b => c) => (a => b) => a => h");

    case 8: return fun(
      fs[0] (fs[1] (fs[2] (fs[3] (fs[4] (fs[5] (fs[6] (fs[7] (x)))))))),
      "(h => i) => (g => h) => (f => g) => (e => f) => (d => e) => (c => d) => (b => c) => (a => b) => a => i");

    case 9: return fun(
      fs[0] (fs[1] (fs[2] (fs[3] (fs[4] (fs[5] (fs[6] (fs[7] (fs[8] (x))))))))),
      "(i => j) => (h => i) => (g => h) => (f => g) => (e => f) => (d => e) => (c => d) => (b => c) => (a => b) => a => j");
  }
};


export const id = fun(x => x, "a => a");


/***[ Composition ]***********************************************************/


// compose in the second argument

export const comp2nd = fun(
  f => g => x => y => f(x) (g(y)),
  "(a => b => c) => (d => b) => a => d => c");


// compose a binary function

export const compBin = fun(
  f => g => x => y => f(g(x) (y)),
  "(a => b) => (c => d => a) => c => d => b");


// transform two inputs and combine the results

export const compOn = fun(
  f => g => x => y => f(g(x)) (g(y)),
  "(b => b => c) => (a => b) => a => a => c");


/***[ Conditional Operator ]**************************************************/


/* While Javascript's conditional operator is a first class expression it is
not lazy. `cond` defers evaluation, because it is a curried function and
furthermore is lazy in its first argument, i.e. we can pass an expensive
computation and only have to evaluate it if all arguments are provided. */

export const cond = fun(
  x => y => thunk => strict(thunk) ? x : y,
  "a => a => b => a");


/***[ Constant ]**************************************************************/


export const _const = fun(
  x => _ => x,
  "a => discard => a");


/***[ Currying ]**************************************************************/


export const curry = fun(
  f => x => y => f(x, y),
  "(a, b => c) => a => b => c");


export const curry3 = fun(
  f => x => y => z => f(x, y, z),
  "(a, b, c => d) => a => b => c => d");


export const curry4 = fun(
  f => w => x => y => z => f(w, x, y, z),
  "(a, b, c, d => e) => a => b => c => d => e");


export const curry5 = fun(
  f => v => w => x => y => z => f(v, w, x, y, z),
  "(a, b, c, d, e => f) => a => b => c => d => e => f");


export const curry6 = fun(
  f => u => v => w => x => y => z => f(u, v, w, x, y, z),
  "(a, b, c, d, e, f => g) => a => b => c => d => e => f => g");


export const uncurry = fun(
  f => (x, y) => f(x) (y),
  "(a => b => c) => a, b => c");


export const uncurry3 = fun(
  f => (x, y, z) => f(x) (y) (z),
  "(a => b => c => d) => a, b, c => d");


export const uncurry4 = fun(
  f => (w, x, y, z) => f(w) (x) (y) (z),
  "(a => b => c => d => e) => a, b, c, d => e");


export const uncurry5 = fun(
  f => (v, w, x, y, z) => f(v) (w) (x) (y) (z),
  "(a => b => c => d => e => f) => a, b, c, d, e => f");


export const uncurry6 = fun(
  f => (u, v, w, x, y, z) => f(u) (v) (w) (x) (y) (z),
  "(a => b => c => d => e => f => g) => a, b, c, d, e, f => g");


/***[ Debugging ]*************************************************************/


export const debug = f => (...args) => {
  debugger;
  return f(...args);
};


export const debugIf = p => f => (...args) => {
  if (p(...args)) debugger;
  return f(...args);
};


export const log = (...args) =>
  (console.log(...args), args[0]);


export const taggedLog = tag => (...args) =>
  (console.log(tag, ...args), args[0]);


export const trace = x =>
  (x => console.log(JSON.stringify(x) || x.toString()), x);


/***[ Equality ]**************************************************************/


export const eq = fun(
  x => y => x === y,
  "a => a => Boolean");


export const neq = fun(
  x => y => x !== y,
  "a => a => Boolean");


/***[ Impure ]****************************************************************/


export const eff = fun(
  f => x => (f(x), x),
  "(a => discard) => a => a");


export const _throw = e => {
  throw e;
};


export const throwOn = fun(
  p => e => msg => x => {
    if (p(x))
      throw new e(msg);
    
    else return x;
  },
  "(a => Boolean) => Function => String => a => discard");


/***[ Local Bindings ]********************************************************/


/* `_let` needs to be untyped, because it relies on an heterogenuous array
holding the arguments. It ensures that the passed function argument is typed,
though. */

export const _let = (...args) => {
  return {in: f => {
    if (CHECK && !(ANNO in f))
      throw new TypeError(cat(
        "typed lambda expected\n",
        `but "${f.toString()}" received\n`));

    else return f(...args);
  }};
};


/***[ Logical Operators ]*****************************************************/


export const and = fun(
  x => y => !!(x && y),
  "a => a => Boolean");


export const andf = fun(
  f => x => y => !!(f(x) && f(y)),
  "(a => b) => a => a => Boolean");


export const imply = fun(
  x => y => !!(!x || y),
  "a => a => Boolean");


export const not = fun(
  x => !x,
  "a => Boolean");


export const notf = fun(
  f => x => !f(x),
  "(a => b) => a => Boolean");


export const or = fun(
  x => y => !!(x || y),
  "a => a => Boolean");


export const orf = fun(
  f => x => y => !!(f(x) || f(y)),
  "(a => b) => a => a => Boolean");


export const xor = fun(
  x => y => !!(!x ^ !y),
  "a => a => Boolean");


/***[ Monoid ]****************************************************************/


lazyProp(F, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = fun(
    Monoid_ => Monoid(F.Semigroup(Monoid_.Semigroup)) ({
      empty: F.empty(Monoid_)
    }),
    "Monoid<b> => Monoid<(a => b)>");
});


F.empty = fun(
  ({empty}) => _ => empty,
  "Monoid<b> => a => b");


/***[ Partial Application ]***************************************************/


export const partial = (f, ...args) => (..._args) => {
  if (CHECK && !(ANNO in f))
    throw new TypeError(cat(
      "typed lambda expected\n",
      `but "${f.toString()}" received\n`));

  else return f(...args, ..._args);
};


/***[ Relational Operators ]**************************************************/


export const gt = fun(
  x => y => x > y,
  "a => a => Boolean");


export const gte = fun(
  x => y => x >= y,
  "a => a => Boolean");


export const lt = fun(
  x => y => x < y,
  "a => a => Boolean");



export const lte = fun(
  x => y => x <= y,
  "a => a => Boolean");


/***[ Semigroup ]*************************************************************/


lazyProp(F, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = fun(
    Semigroup_ => Semigroup({
      append: F.append(Semigroup_)
    }),
    "Semigroup<b> => Semigroup<(a => b)>");
});


F.append = fun(
  ({append}) => f => g => x => append(f(x)) (g(x)),
  "Semigroup<b> => (a => b) => (a => b) => a => b");


/***[ Short Circuiting ]******************************************************/


export const and_ = fun(
  x => y => x && y,
  "a => a => a");


export const andf_ = fun(
  f => x => y => f(x) && f(y),
  "(a => b) => a => a => b");


export const or_ = fun(
  x => y => x || y,
  "a => a => a");


export const orf_ = fun(
  f => x => y => f(x) || f(y),
  "(a => b) => a => a => b");


/******************************************************************************
*****************************[ FUNCTION >> ENDO ]******************************
******************************************************************************/


export const Endo = type1("(a => a) => Endo<a>");


Endo.run = fun(
  tx => x => tx.run(x),
  "Endo<a> => a => a");


/***[ Monoid ]****************************************************************/


lazyProp(Endo, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = Monoid(Endo.Semigroup) ({
    empty: Endo.empty
  });
});


// Endo<a>

Endo.empty = Endo(id);


/***[ Semigroup ]*************************************************************/


lazyProp(Endo, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = Semigroup({
    append: Endo.append
  });
});


Endo.append = fun(
  f => g => Endo(fun(
    x => f.run(g.run(x)),
    "a => a")),
  "Endo<a> => Endo<a> => Endo<a>");


/******************************************************************************
***********************************[ ARRAY ]***********************************
******************************************************************************/


/* Array is designed as a mutable data type and treated as such. Use immutable
`List` for an efficient `cons` operation. Use immutable `DList` for efficient
`append` and `snoc` operations. Use `Vector` for efficient lookups or set and
modify operations. */


export const A = {}; // namespace


/***[ Apply ]****************************************************************/


lazyProp(A, "Apply", function() {
  delete this.Apply;
  
  return this.Apply = Apply(A.Functor) ({
    apply: A.apply
  });
});


A.apply = fun(
  fs => xs =>
    A.foldl(fun(
      acc => f => A.append(acc) (A.map(f) (xs)),
      "[b] => (a => b) => [b]")) ([]) (fs),
  "[(a => b)] => [a] => [b]");


/***[ Applicative ]***********************************************************/


lazyProp(A, "Applicative", function() {
  delete this.Applicative;
  
  return this.Applicative = Applicative(A.Apply) ({
    of: A.of
  });
});


A.of = fun(x => [x], "a => [a]");


/***[ Chain ]*****************************************************************/


lazyProp(A, "Chain", function() {
  delete this.Chain;
  
  return this.Chain = Chain(A.Apply) ({
    chain: A.chain
  });
});


A.chain = fun(
  xs => fm => xs.flatMap(x => fm(x)),
  "[a] => (a => [b]) => [b]");


/***[ Clonable ]**************************************************************/


A.clone = fun(
  xs => xs.concat(),
  "[a] => [a]");


/***[ Construction ]**********************************************************/


A.push = fun(
  x => xs => (xs.push(x), xs),
  "a => [a] => [a]");


A.unshift = fun(
  x => xs => (xs.unshift(x), xs),
  "a => [a] => [a]");


/***[ Foldable ]**************************************************************/


/* The left associative fold for arrays is implemented as a loop to ensure
stack safety. */

A.foldl = fun(
  f => init => xs => {
    let acc = init;

    for (let i = 0; i < xs.length; i++)
      acc = f(acc) (xs[i]);

    return acc;
  },
  "(b => a => b) => b => [a] => b");


/* `A.foldk` is like `A.foldr` but with the ability to short circuit. The fold
isn't type safe on its own but the continuation can contain a thunk rendering
the whole computation lazy. `strictRec` can than be used to run through the
iterations without exhausting the stack. */

lazyProp(A, "foldk", function() {
  delete this.foldk;
  
  return this.foldk = fun(
    f => init => xs => function go(acc, i) {
      return i >= xs.length
        ? acc
        : f(acc) (xs[i]).run(fun(acc_ => go(acc_, i + 1), "b => b"));
    } (init, 0),
    "(b => a => Cont<b, b>) => b => [a] => b");
});


/* Since array is an imperative data type the right associative fold is
implemented as an eager loop to ensure stack safety. */

A.foldr = fun(
  f => init => xs => {
    const stack = [];
    let acc = init;

    for (let i = 0; i < xs.length; i++)
      stack.push(f(xs[i]));

    for (let i = stack.length - 1; i >= 0; i--)
      acc = stack[i] (acc);

    return acc;
  },
  "(a => b => b) => b => [a] => b");


/***[ Folds ]*****************************************************************/


A.cata = A.foldr;


/* Due to `Array`'s imperative nature its paramorphism is very inefficient and
not capable of handling infinite corecursion. It is only supplied for the sake
of completeness. */

A.para = fun(
  f => init => xs => {
    const tail = xs;
    let acc = init;

    for (let i = xs.length - 1; i >= 0; i--) {
      acc = f(xs[i]) (tail.slice(xs.length - i)) (acc);
    }

    return acc;
  },
  "(a => [a] => b => b) => b => [a] => b");


/***[ Functor ]***************************************************************/


lazyProp(A, "Functor", function() {
  delete this.Functor;
  
  return this.Functor = Functor({
    map: A.map
  });
});


A.map = fun(
  f => xs => xs.map(x => f(x)),
  "(a => b) => [a] => [b]");


/***[ Looping ]***************************************************************/


A.forEach = fun(
  f => xs => (xs.forEach((x, i) => xs[i] = f(x)), xs),
  "(a => b) => [a] => [b]");


/***[ Monad ]*****************************************************************/


lazyProp(A, "Monad", function() {
  delete this.Monad;
  return this.Monad = Monad(A.Applicative, A.Chain) ({});
});


/***[ Monoid ]****************************************************************/


lazyProp(A, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = Monoid(A.Semigroup) ({
    empty: A.empty
  });
});


// [a]

A.empty = [];


/***[ Semigroup ]*************************************************************/


lazyProp(A, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = Semigroup({
    append: A.append
  });
});


A.append = fun(
  xs => ys => (xs.push.apply(xs, ys), xs),
  "[a] => [a] => [a]");


/* There is an additional `prepend` operation on the `Array` type, because the
latter is mutable and thus this operation is frequently needed along with the
`Mutable` type. */

A.prepend = fun(
  ys => xs => (xs.push.apply(xs, ys), xs),
  "[a] => [a] => [a]");


/***[ Unfoldable ]************************************************************/


/* Due to `Array`'s imperative nature its anamorphism is very inefficient and
not capable of handling infinite corecursion. It is only supplied for the sake
of completeness. */

lazyProp(A, "unfoldr", function() {
  delete this.unfoldr;
  
  return this.unfoldr = fun(
    f => init => {
      let acc = [],
        state = init,
        next;

      do {
        next = false;

        acc = f(state).run({
          none: acc,
          some: fun(
            ([x, state_]) => {
              state = state_;
              next = true;
              return acc.concat([x]);
            },
            "[a, b] => [a]")
        });
      } while (next);

      return acc;
    },
    "(b => Option<[a, b]>) => b => [a]");
});


/***[ Unfolds ]***************************************************************/


lazyProp(A, "ana", function() {
  delete this.ana;
  return this.ana = A.unfoldr;
});


/* Due to `Array`'s imperative nature its apomorphism is very inefficient and
not capable of handling infinite corecursion. It is only supplied for the sake
of completeness. */

lazyProp(A, "apo", function() {
  delete this.apo;

  return this.apo = fun(
    f => init => {
      let acc = [],
        state = init,
        next;

      do {
        next = false;

        acc = f(state).run({
          none: acc,
          some: fun(
            ([x, tx]) =>
              tx.run({
                left: fun(
                  xs => acc.concat(xs),
                  "[a] => [a]"),

                right: fun(
                  state_ => {
                    state = state_;
                    next = true;
                    return acc.concat([x]);
                  },
                  "b => [a]")
              }),
            "[a, Either<[a], b>] => [a]")
        });
      } while (next);

      return acc;
    },
    "(b => Option<[a, Either<[a], b>]>) => b => [a]");
});


/******************************************************************************
**********************************[ BOOLEAN ]**********************************
******************************************************************************/


export const Bool = {}; // namespace


/***[ Bounded ]***************************************************************/


lazyProp(Bool, "Bounded", function() {
  delete this.Bounded;
  
  return this.Bounded = Bounded({
    min: Bool.minBound,
    max: Bool.maxBound
  });
});


Bool.minBound = false;


Bool.maxBound = true;


/***[ Equality ]**************************************************************/


Bool.eq = fun(
  x => y => x === y,
  "Boolean => Boolean => Boolean");


Bool.neq = fun(
  x => y => x !== y,
  "Boolean => Boolean => Boolean");


/***[ Logical Operators ]*****************************************************/


Bool.and = fun(
  x => y => x && y,
  "Boolean => Boolean => Boolean");


Bool.imply = fun(
  x => y => !x || y,
  "Boolean => Boolean => Boolean");


Bool.not = fun(
  x => !x,
  "Boolean => Boolean");


Bool.or = fun(
  x => y => x || y,
  "Boolean => Boolean => Boolean");


Bool.xor = fun(
  x => y => x !== y,
  "Boolean => Boolean => Boolean");


/***[ Relational Operators ]**************************************************/


Bool.gt = fun(
  x => y => x > y,
  "Boolean => Boolean => Boolean");


Bool.gte = fun(
  x => y => x >= y,
  "Boolean => Boolean => Boolean");


Bool.lt = fun(
  x => y => x < y,
  "Boolean => Boolean => Boolean");



Bool.lte = fun(
  x => y => x <= y,
  "Boolean => Boolean => Boolean");


/******************************************************************************
******************************[ BOOLEAN :: ALL ]*******************************
******************************************************************************/


// constructor + namespace

export const All = type1("Boolean => All");


/***[ Monoid ]****************************************************************/


lazyProp(All, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = Monoid({
    empty: All.empty
  });
});


All.empty = true;


/***[ Semigroup ]*************************************************************/


lazyProp(All, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = Semigroup({
    append: All.append
  });
});


All.append = fun(
  tx => ty => All(tx.run && ty.run),
  "All => All => All");


/******************************************************************************
******************************[ BOOLEAN :: ANY ]*******************************
******************************************************************************/


// constructor + namespace

export const Any = type1("Boolean => Any");


/***[ Monoid ]****************************************************************/


lazyProp(Any, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = Monoid({
    empty: Any.empty
  });
});


Any.empty = false;


/***[ Semigroup ]*************************************************************/


lazyProp(Any, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = Semigroup({
    append: Any.append
  });
});


Any.append = fun(
  tx => ty => Any(tx.run || ty.run),
  "Any => Any => Any");


/******************************************************************************
********************************[ COMPARATOR ]*********************************
******************************************************************************/


/* `Comparator` is compatible with Javascript's sorting protocoll. */


// type constructor + namespace

export const Comparator = type(
  "(^r. {lt: r, eq: r, gt: r} => r) => Comparator");


// value constructors

Comparator.LT = Object.assign(Comparator(({lt}) => lt), {valueOf: () => -1});


Comparator.EQ = Object.assign(Comparator(({eq}) => eq), {valueOf: () => 0});


Comparator.GT = Object.assign(Comparator(({gt}) => gt), {valueOf: () => 1});


/***[ Monoid ]****************************************************************/


lazyProp(Comparator, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = Monoid(Comparator.Semigroup) ({
    empty: Comparator.empty
  });
});


// Comparator

Comparator.empty = Comparator.EQ;


/***[ Semigroup ]*************************************************************/


lazyProp(Comparator, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = Semigroup({
    append: Comparator.append
  });
});


Comparator.append = fun(
  tx => ty =>
    tx.run({
      lt: tx,
      eq: ty,
      gt: tx
    }),
  "Comparator => Comparator => Comparator");


/******************************************************************************
***********************************[ CONT ]************************************
******************************************************************************/


/* `Cont` is the pure version of `Serial`, i.e. there is no micro task deferring.
It facilitates continuation passing style and can be used with both synchronous
and asynchronous computations. Please be aware that `Cont` is not stack-safe for
large nested function call trees. */

export const Cont = type1("((a => r) => r) => Cont<r, a>");


export const liftk2 = fun(
  f => x => y => Cont(fun(
    k => k(f(x) (y)),
    "(c => r) => r")),
  "(a => b => c) => a => b => Cont<r, c>");


/******************************************************************************
*********************************[ COYONEDA ]**********************************
******************************************************************************/


/*const Coyoneda_ = type1("(^r. (^b. (b => a) => f<b> => r) => r) => Coyoneda<f, a>");


export const Coyoneda = fun(f => tx => Coyoneda_(fun(
  k => k(f) (tx),
  "((b => a) => f<b> => r) => r")),
  "(b => a) => f<b> => Coyoneda<f, a>");


Coyoneda.lift = Coyoneda(id);


Coyoneda.lower = fun(
  ({map}) => tx => tx.run(fun(
    f => ty => map(f) (ty),
    "(b => a) => f<b> => f<a>")),
  "Functor<f> => Coyoneda<f, a> => f<b>");*/


/******************************************************************************
**********************************[ EITHER ]***********************************
******************************************************************************/


export const Either = type(
  "(^r. {left: (a => r), right: (b => r)} => r) => Either<a, b>");


Either.Left = fun(
  x => Either(({left, right}) => left(x)),
  "a => Either<a, b>");


Either.Right = fun(
  x => Either(({left, right}) => right(x)),
  "b => Either<a, b>");


/******************************************************************************
***********************************[ LIST ]************************************
******************************************************************************/


export const List = type(
  "(^r. {nil: r, cons: (a => List<a> => r)} => r) => List<a>");


List.Cons = fun(
  x => xs => List(({cons}) => cons(x) (xs)),
  "a => List<a> => List<a>");


List.Nil = List(({nil}) => nil);


/***[ Foldable ]**************************************************************/


lazyProp(List, "Foldable", function() {
  delete this.Foldable;
  
  return this.Foldable = Foldable({
    foldl: List.foldl,
    foldr: List.foldr
  });
});


List.foldl = fun(
  f => function go(acc) {
    return xs => xs.run({
      nil: acc,
      cons: fun(
        x => ys => go(f(acc) (x)) (ys),
        "a => List<a> => b")
    });
  },
  "(b => a => b) => b => List<a> => b");


List.foldMap = fun(
  Monoid => foldMap(List.Foldable, Monoid),
  "Monoid<m> => (a => m) => List<a> => m");


List.foldMap_ = fun(
  Monoid => foldMap_(List.Foldable, Monoid),
  "Monoid<m> => (a => m) => List<a> => m");


List.foldr = fun(
  f => acc => function go(xs) {
    return xs.run({
      nil: acc,
      cons: fun(
        x => ys => f(x) (thunk(() => go(ys), "() => b")),
        "a => List<a> => b")
    });
  },
  "(a => b => b) => b => List<a> => b");


/***[ Monoid ]****************************************************************/


lazyProp(List, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = Monoid(List.Semigroup) ({
    empty: List.empty
  });
});


List.empty = List.Nil;


/***[ Semigroup ]*************************************************************/


lazyProp(List, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = Semigroup({
    append: List.append
  });
});


List.append = fun(
  xs => ys => function go(acc) {
    return acc.run({
      nil: ys,
      cons: fun(
        x => zs => List.Cons(x)
          (thunk(() => go(zs), "() => List<a>")),
        "a => List<a> => List<a>")
    });
  } (xs),
  "List<a> => List<a> => List<a>");


/******************************************************************************
*******************************[ LIST :: DLIST ]*******************************
******************************************************************************/


// like a regular list but with efficient concat/snoc operations

export const DList = type1(
  "(List<a> => List<a>) => DList<a>");


DList.run = fun(
  f => f.run,
  "DList<a> => List<a> => List<a>");


/***[ Construction ]**********************************************************/


// a => DList<a> => DList<a>

DList.cons = x => xs =>
  DList(comp(List.Cons(x)) (DList.run(xs)));


// a => DList<a> => DList<a>

DList.snoc = x => xs =>
  DList(comp(DList.run(xs)) (List.Cons(x)));


// a => DList<a>

DList.singleton = comp(DList) (List.Cons);


/***[ Conversion ]************************************************************/


// List<a> => DList<a>

DList.fromList = comp(DList) (List.append);


// DList<a> => List<a>

DList.toList = comp(app_(List.Nil)) (DList.run);


/***[ Monoid ]****************************************************************/


lazyProp(DList, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = Monoid(DList.Semigroup) ({
    empty: DList.empty
  });
});


DList.empty = DList(id);


/***[ Semigroup ]*************************************************************/


lazyProp(DList, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = Semigroup({
    append: DList.append
  });
});


DList.append = fun(
  xs => ys => DList(comp(xs.run) (ys.run)),
  "DList<a> => DList<a> => DList<a>");


/******************************************************************************
**********************************[ NUMBER ]***********************************
******************************************************************************/


export const Num = {}; // namespace


/***[ Arithmetic Operators ]**************************************************/


export const add = fun(
  x => y => x + y,
  "Number => Number => Number");


export const div = fun(
  x => y => x / y,
  "Number => Number => Number");


export const exp = fun(
  exp => base => base ** exp,
  "Number => Number => Number");


export const dec = fun(
  x => x - 1,
  "Number => Number");


export const inc = fun(
  x => x + 1,
  "Number => Number");


export const mod = fun(
  x => y => x % y,
  "Number => Number => Number");


export const mul = fun(
  x => y => x * y,
  "Number => Number => Number");


export const neg = fun(
  x => -x,
  "Number => Number");


export const sub = fun(
  x => y => x - y,
  "Number => Number => Number");


/***[ Bitwise Operators ]*****************************************************/


export const bitAnd = fun(
  x => y => x & y,
  "Number => Number => Number");


export const bitNot = fun(
  x => ~x,
  "Number => Number");


export const bitOr = fun(
  x => y => x | y,
  "Number => Number => Number");


export const bitXor = fun(
  x => y => x ^ y,
  "Number => Number => Number");


/******************************************************************************
******************************[ NUMBER :: PROD ]*******************************
******************************************************************************/


// constructor + namespace

export const Prod = type1("Number => Prod");


/***[ Monoid ]****************************************************************/


lazyProp(Prod, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = Monoid(Prod.Semigroup) ({
    empty: Prod.empty
  });
});


Prod.empty = Prod(1);


/***[ Semigroup ]*************************************************************/


lazyProp(Prod, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = Semigroup({
    append: Prod.append
  });
});


Prod.append = fun(
  tx => ty => Prod(tx.run * ty.run),
  "Prod => Prod => Prod");


/******************************************************************************
*******************************[ NUMBER :: SUM ]*******************************
******************************************************************************/


// constructor + namespace

export const Sum = type1("Number => Sum");


/***[ Monoid ]****************************************************************/


lazyProp(Sum, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = Monoid(Sum.Semigroup) ({
    empty: Sum.empty
  });
});


Sum.empty = Sum(0);


/***[ Semigroup ]*************************************************************/


lazyProp(Sum, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = Semigroup({
    append: Sum.append
  });
});


Sum.append = fun(
  tx => ty => Sum(tx.run + ty.run),
  "Sum => Sum => Sum");


/******************************************************************************
**********************************[ OBJECT ]***********************************
******************************************************************************/


/* Implicitly provides an empty object along with a reference on it to enable
local mutations on it. `this` itself is untyped but ensures that the passed
lambda is. */

export const thisify = f => {
  if (CHECK && !(ANNO in f))
    throw new TypeError(cat(
      "typed lambda expected\n",
      `but "${f.toString()}" received\n`));

  else return f({});
};


/******************************************************************************
**********************************[ OPTION ]***********************************
******************************************************************************/


// type of expressions that may not yield a result

export const Option = type("(^r. {none: r, some: (a => r)} => r) => Option<a>");


Option.Some = fun(
  x => Option(({some}) => some(x)),
  "a => Option<a>");


// Option<a>

Option.None = Option(({none}) => none);


/***[ Monoid ]****************************************************************/


lazyProp(Option, "Monoid", function() {
  delete this.Monoid;
  
  return this.Monoid = fun(
    Semigroup => Monoid(Option.Semigroup(Semigroup)) ({
      empty: Option.empty
    }),
    "Semigroup<a> => Monoid<Option<a>>");
});


// Option<a>

Option.empty = Option.None;


/***[ Semigroup ]*************************************************************/


lazyProp(Option, "Semigroup", function() {
  delete this.Semigroup;
  
  return this.Semigroup = fun(
    Semigroup_ => Semigroup({
      append: Option.append(Semigroup_)
    }),
    "Semigroup<a> => Semigroup<Option<a>>");
});


Option.append = fun(
  ({append}) => tx => ty =>
    tx.run({
      none: ty,
      some: fun(
        x => ty.run({
          none: tx,
          some: fun(
            y => Option.Some(append(x) (y)),
            "a => Option<a>")
        }),
        "a => Option<a>")
    }),
    "Semigroup<a> => Option<a> => Option<a> => Option<a>");


/******************************************************************************
*********************************[ PARALLEL ]**********************************
******************************************************************************/


/* Like `Serial` but is executed in parallel. Please note that `Parallel`
doesn't implement monad, because they require order. */

export const Parallel = type1("((a => r) => r) => Parallel<r, a>");


/******************************************************************************
**********************************[ SERIAL ]***********************************
******************************************************************************/


/* `Serial` provides stack-safe asynchronous computations, which are executed
serially. It creates a lazy CPS composition that itself is either executed
synchronuously within the same micro task or asynchronously in a subsequent one.
The actual behavior depends on a PRNG and cannot be determined upfront. You can
pass both synchronous and asynchronous functions to the CPS composition. */

export const Serial = type1("((a => r) => r) => Serial<r, a>");


/******************************************************************************
********************************[ TRANSDUCER ]*********************************
******************************************************************************/


/* In order to simplify composing transducers and for performance reasons the
raw type is used rather than the `Transducer<a, b>` wrapper. Each transducer is
implemented in two variants: A normal one and one with short circuit semantics
using local continuations. While the former is more efficient for computations
that run to completion, the latter is more efficient in connection with early
breaks. */


export const filter = fun(
  p => cons => x =>
    p(x) ? cons(x) : id,
  "(a => Boolean) => (a => r => r) => a => r => r");


export const filterk = fun(
  p => cons => acc => x => Cont(fun(
    k => p(x) ? cons(acc) (x).run(k) : k(acc),
    "(a => r) => r")),
  "(a => Boolean) => (r => a => Cont<r, r>) => r => a => Cont<r, r>");


export const map = fun(
  f => cons => x => cons(f(x)),
  "(a => b) => (b => r => r) => a => r => r");


export const mapk = fun(
  f => cons => acc => x => Cont(fun(
    k => cons(acc) (f(x)).run(k),
    "(b => r) => r")),
  "(a => b) => (r => b => Cont<r, r>) => r => a => Cont<r, r>");


export const take = fun(
  n => cons => function (m) {
    return fun(
      x => n <= m ? id : (m++, cons(x)),
      "a => r");
  } (0),
  "Number => (a => r => r) => a => r => r");


export const takek = fun(
  n => cons => function (m) {
    return acc => x => Cont(fun(
      k => n <= m ? acc : (m++, cons(acc) (x).run(k)),
      "(a => r) => r"));
  } (0),
  "Number => (r => a => Cont<r, r>) => r => a => Cont<r, r>");


/******************************************************************************
**********************************[ VECTOR ]***********************************
******************************************************************************/


// internal constructor

const Vector_ = (data, length, offset) => ({
  [TAG]: "Vector",
  data,
  length,
  offset
})


// public constructor and namespace

export const Vector = Vector_(Leaf, 0, 0);


/***[ Accessors ]*************************************************************/


Vector.get = fun(
  i => v =>
    get(v.data, i + v.offset, Vector.compare),
  "Number => Vector<a> => a");


/***[ Construction ]**********************************************************/


// consing at the beginning of a `Vector`

Vector.cons = fun(
  x => v => {
    const offset = v.length === 0 ? 0 : v.offset - 1,
      data = set(v.data, offset, x, Vector.compare);

    return Vector_(data, v.length + 1, offset);
  },
  "a => Vector<a> => Vector<a>");


// consing at the end of a `Vector`

Vector.snoc = fun(
  x => v => {
    const data = set(v.data, v.length + v.offset, x, Vector.compare);
    return Vector_(data, v.length + 1, v.offset);
  },
  "a => Vector<a> => Vector<a>");


/***[ Order ]*****************************************************************/


Vector.compare = fun(
  (m, n) => m < n ? LT : m === n ? EQ : GT,
  "Number, Number => Number");


/***[ Searching ]*************************************************************/


Vector.elem = fun(
  i => v =>
    has(v.data, i + v.offset, Vector.compare),
  "Number => Vector<a> => Boolean");


/******************************************************************************
**********************************[ YONEDA ]***********************************
******************************************************************************/


export const Yoneda = type1("(^b. (a => b) => f<b>) => Yoneda<f, a>");


/***[ De-/Construction ]******************************************************/


Yoneda.lift = fun(
  ({map}) => tx => Yoneda(fun(
    f => map(f) (tx),
    "(a => b) => f<b>")),
  "Functor<f> => f<a> => Yoneda<f, a>");


Yoneda.lower = fun(
  tx => tx.run(id),
  "Yoneda<f, a> => f<a>");


/***[ Functor ]***************************************************************/


lazyProp(Yoneda, "Functor", function() {
  delete this.Functor;
  
  return this.Functor = Functor({
    map: Yoneda.map
  });
});


Yoneda.map = fun(
  f => tx => Yoneda(fun(
    g => tx.run(comp(g) (f)),
    "(a => b) => f<b>")),
  "(a => b) => Yoneda<f, a> => Yoneda<f, b>");


/******************************************************************************
*********************************[ DEPENDENT ]*********************************
******************************************************************************/


Enum = Enum(Option);
export {Enum};


Filterable = Filterable(Option, Either);
export {Filterable};
