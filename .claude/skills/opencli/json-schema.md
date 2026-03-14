# OpenCLI JSON Schema

## Overview

The official JSON Schema for validating OpenCLI documents. Reference this schema in your documents with `"$schema": "https://opencli.org/draft.json"`. This is OpenCLI spec version 0.1.

## Full Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "OpenCLI.json",
  "type": "object",
  "properties": {
    "opencli": { "type": "string", "description": "The OpenCLI version number" },
    "info": { "$ref": "#/$defs/CliInfo", "description": "Information about the CLI" },
    "conventions": { "$ref": "#/$defs/Conventions", "description": "The conventions used by the CLI" },
    "arguments": { "type": "array", "items": { "$ref": "#/$defs/Argument" }, "description": "Root command arguments" },
    "options": { "type": "array", "items": { "$ref": "#/$defs/Option" }, "description": "Root command options" },
    "commands": { "type": "array", "items": { "$ref": "#/$defs/Command" }, "description": "Root command sub commands" },
    "exitCodes": { "type": "array", "items": { "$ref": "#/$defs/ExitCode" }, "description": "Root command exit codes" },
    "examples": { "type": "array", "items": { "type": "string" }, "description": "Examples of how to use the CLI" },
    "interactive": { "type": "boolean", "default": false, "description": "Indicates whether or not the command requires interactive input" },
    "metadata": { "type": "array", "items": { "$ref": "#/$defs/Metadata" }, "description": "Custom metadata" }
  },
  "required": ["opencli", "info"],
  "$defs": {
    "CliInfo": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "summary": { "type": "string" },
        "description": { "type": "string" },
        "contact": { "$ref": "#/$defs/Contact" },
        "license": { "$ref": "#/$defs/License" },
        "version": { "type": "string" }
      },
      "required": ["title", "version"]
    },
    "Conventions": {
      "type": "object",
      "properties": {
        "groupOptions": { "type": "boolean", "default": true },
        "optionSeparator": { "type": "string", "default": " " }
      }
    },
    "Argument": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "required": { "type": "boolean", "default": false },
        "arity": { "$ref": "#/$defs/Arity" },
        "acceptedValues": { "type": "array", "items": { "type": "string" } },
        "group": { "type": "string" },
        "description": { "type": "string" },
        "hidden": { "type": "boolean", "default": false },
        "metadata": { "type": "array", "items": { "$ref": "#/$defs/Metadata" } }
      },
      "required": ["name"]
    },
    "Option": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "required": { "type": "boolean", "default": false },
        "aliases": { "type": "array", "items": { "type": "string" }, "uniqueItems": true },
        "arguments": { "type": "array", "items": { "$ref": "#/$defs/Argument" } },
        "group": { "type": "string" },
        "description": { "type": "string" },
        "recursive": { "type": "boolean", "default": false },
        "hidden": { "type": "boolean", "default": false },
        "metadata": { "type": "array", "items": { "$ref": "#/$defs/Metadata" } }
      },
      "required": ["name"]
    },
    "Command": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "aliases": { "type": "array", "items": { "type": "string" }, "uniqueItems": true },
        "options": { "type": "array", "items": { "$ref": "#/$defs/Option" } },
        "arguments": { "type": "array", "items": { "$ref": "#/$defs/Argument" } },
        "commands": { "type": "array", "items": { "$ref": "#/$defs/Command" } },
        "exitCodes": { "type": "array", "items": { "$ref": "#/$defs/ExitCode" } },
        "description": { "type": "string" },
        "hidden": { "type": "boolean", "default": false },
        "examples": { "type": "array", "items": { "type": "string" } },
        "interactive": { "type": "boolean", "default": false },
        "metadata": { "type": "array", "items": { "$ref": "#/$defs/Metadata" } }
      },
      "required": ["name"]
    },
    "ExitCode": {
      "type": "object",
      "properties": {
        "code": { "type": "integer" },
        "description": { "type": "string" }
      },
      "required": ["code"]
    },
    "Metadata": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "value": {}
      },
      "required": ["name"]
    },
    "Contact": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "url": { "type": "string", "format": "uri" },
        "email": { "$ref": "#/$defs/email" }
      }
    },
    "License": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "identifier": { "type": "string" },
        "url": { "type": "string" }
      }
    },
    "Arity": {
      "type": "object",
      "properties": {
        "minimum": { "type": "integer", "default": 1, "minimum": 0 },
        "maximum": { "type": "integer", "default": 1, "minimum": 0 }
      }
    },
    "email": {
      "type": "string",
      "pattern": ".+\\@.+\\..+"
    }
  }
}
```

## Usage

Reference the schema in your OpenCLI documents for editor validation and autocompletion:

```json
{
  "$schema": "https://opencli.org/draft.json",
  "opencli": "0.1",
  "info": { "title": "my-tool", "version": "1.0.0" }
}
```

## Docs

- Schema source: <https://opencli.org/draft.json>
