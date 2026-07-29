(comment) @comment

; Selectors
(tag_name) @tag
(class_name) @tag
(id_name) @tag
(class_selector "." @punctuation.delimiter)
(id_selector "#" @punctuation.delimiter)
(pseudo_class_name) @tag
(pseudo_element_name) @tag
(pseudo_class_selector ":" @punctuation.delimiter)
(pseudo_element_selector "::" @punctuation.delimiter)
(attribute_name) @property
(parent_selector) @variable.special
(parent_suffix) @tag
(universal_selector) @tag
(combinator) @operator
(reference_selector "^" @operator)
(root_reference "/" @operator)
(relative_reference "../" @operator)
(namespace_selector "|" @operator)
(at_pseudo_selector ":" @punctuation.delimiter)
(pseudo_interpolation_selector ":" @punctuation.delimiter)

; Properties
(property_name) @property

; Variables
(variable) @variable
(variable_name) @variable

; Functions / mixins
(call_expression function: (identifier) @function)
(call_expression function: (variable) @function)
(call_statement function: (identifier) @function)
(call_statement function: (interpolated_name) @function)
(block_call_statement function: (identifier) @function)
(mixin_definition name: (identifier) @function)
(anonymous_function "@" @keyword)
(parameter (identifier) @variable.parameter)
(parameter (variable) @variable.parameter)
(named_argument (property_name) @variable.parameter)

; Values
(color_value) @string.special
(number) @number
(unit) @type
(string_value) @string
(boolean_value) @boolean
(null_value) @constant.builtin
(important) @keyword
(optional_flag) @keyword
(url_value) @string.special
(unicode_range) @string.special
(escape_sequence) @string.escape
(interpolation
  "{" @punctuation.special
  "}" @punctuation.special)

; At-rules and keywords
(at_keyword) @keyword

[
  "if"
  "unless"
  "else"
  "for"
  "in"
  "return"
  "and"
  "or"
  "not"
  "is"
  "isnt"
  "from"
  "to"
  "only"
] @keyword

; Operators
[
  "+"
  "-"
  "*"
  "/"
  "%"
  "**"
  "&&"
  "||"
  "!"
  "~"
  "=="
  "!="
  "<"
  "<="
  ">"
  ">="
  "="
  "?="
  ":="
  "+="
  "-="
  "*="
  "/="
  "%="
  "~="
  "^="
  "$="
  "|="
  "?"
  ".."
  "..."
] @operator

; Punctuation
[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  ":"
  ";"
] @punctuation.delimiter
