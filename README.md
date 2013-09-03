This is a baby Scheme interpreter in continuation-passing style with tail calls and call/cc. Written in CoffeeScript, compiled to JavaScript, runs in the browser.

* [REPL](http://sstephenson.github.io/s/)
* [Source code](s.coffee)

The purpose of this exercise was to help me reach an intuitive understanding of continuations. My approach of structuring continuations as data structures rather than higher-order procedures is based on the ideas in Chapter 5 of [Essentials of Programming Languages](http://www.amazon.com/Essentials-Programming-Languages-Daniel-Friedman/dp/0262062798), 3rd ed.

The code here may be of interest to anyone else without a formal CS education but nonetheless curious about the nature of computing. It may also provide a good jumping-off point for anyone wishing to explore the following:

* Graphical programming. Replace the parser with an HTML UI for composing source code and inspecting values.
* Threading, concurrency, and scheduling. Adjust the interpreter's `run` method to implement green threads, or spawn web workers for multiprocessing.
* Macros. Implement quasiquote, unquote, and unquote-splicing. Go all the way with R6RS hygienic macros.
* Safe code execution. Bridge a safe subset of JavaScript with Scheme and embed it in your web application for third-party extensions.

&copy; 2013 Sam Stephenson<br>
MIT licensed
