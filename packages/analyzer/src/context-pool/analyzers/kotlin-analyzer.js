"use strict";
/**
 * Kotlin/Android Analyzer
 * Analyzes native Android apps (Kotlin + Java)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KotlinAnalyzer = void 0;
var fs_extra_1 = require("fs-extra");
var path_1 = require("path");
var KotlinAnalyzer = /** @class */ (function () {
    function KotlinAnalyzer(projectDir) {
        this.projectDir = projectDir;
    }
    KotlinAnalyzer.prototype.analyzeScreen = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var content, relativePath, fileName;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs_extra_1.default.readFile(filePath, 'utf-8')];
                    case 1:
                        content = _a.sent();
                        relativePath = path_1.default.relative(this.projectDir, filePath);
                        fileName = path_1.default.basename(filePath, path_1.default.extname(filePath));
                        return [2 /*return*/, {
                                name: this.extractScreenName(fileName),
                                filePath: relativePath,
                                type: 'screen',
                                widgets: this.extractWidgets(content),
                                navigation: {
                                    accessibleFrom: [],
                                    accessibleVia: [],
                                    isInitial: fileName.toLowerCase().includes('main') || fileName.toLowerCase().includes('home'),
                                    requiresAuth: fileName.toLowerCase().includes('profile'),
                                },
                                testability: {
                                    hasTextElements: /setText|text\s*=/.test(content),
                                    hasOnlyIcons: /ImageView|icon/.test(content) && !/setText|text\s*=/.test(content),
                                    testableElements: [],
                                    assertionStrategy: 'text',
                                },
                            }];
                }
            });
        });
    };
    KotlinAnalyzer.prototype.extractWidgets = function (content) {
        var widgets = [];
        var contentWithoutDialogs = this.removeDialogContent(content);
        // Extract setText() calls on TextView/Button
        var textRegex = /(?:findViewById<TextView|findViewById<Button>)\([^)]+\)\.setText\("([^"]+)"\)/g;
        var match;
        while ((match = textRegex.exec(contentWithoutDialogs)) !== null) {
            var text = match[1].trim();
            if (text && text.length > 0 && text.length < 200) {
                widgets.push({
                    type: 'text',
                    value: text,
                });
            }
        }
        // Extract Button onClick listeners
        var buttonRegex = /(?:findViewById<Button>)\([^)]+\)\.setOnClickListener\s*{[^}]*}/g;
        while ((match = buttonRegex.exec(contentWithoutDialogs)) !== null) {
            // Extract button text from nearby setText or from XML parsing
            var buttonText = this.extractButtonText(content, match.index);
            if (buttonText) {
                var action = this.extractButtonAction(content, buttonText);
                widgets.push({
                    type: 'button',
                    label: buttonText,
                    action: action,
                });
            }
        }
        // Extract EditText hints
        var editTextRegex = /(?:findViewById<EditText>)\([^)]+\)\.hint\s*=\s*"([^"]+)"/g;
        while ((match = editTextRegex.exec(contentWithoutDialogs)) !== null) {
            var hint = match[1].trim();
            widgets.push({
                type: 'input',
                label: hint,
            });
        }
        return widgets;
    };
    KotlinAnalyzer.prototype.extractButtonText = function (content, buttonIndex) {
        // Look backwards from button to find setText call
        var beforeButton = content.substring(0, buttonIndex);
        var textMatch = /setText\("([^"]+)"\)/.exec(beforeButton);
        return textMatch ? textMatch[1] : undefined;
    };
    KotlinAnalyzer.prototype.extractButtonAction = function (content, buttonText) {
        // Find setOnClickListener block for this button
        var buttonBlockRegex = new RegExp("findViewById<Button>\\([^)]+\\)\\.setOnClickListener\\s*{([^{]*(?:{[^{]*})*[^}]*)}", 'gs');
        var match = buttonBlockRegex.exec(content);
        if (!match)
            return undefined;
        var clickContent = match[1];
        return this.extractNavigationFromClick(clickContent);
    };
    KotlinAnalyzer.prototype.extractNavigationFromClick = function (clickContent) {
        // Jetpack Navigation patterns
        var navMatch = /findNavController[^}]*navigate\(R\.id\.(\w+)\)/.exec(clickContent);
        if (navMatch) {
            return {
                type: 'navigation',
                target: navMatch[1],
                description: "Navigate to ".concat(navMatch[1]),
            };
        }
        // Intent-based navigation
        var intentMatch = /Intent\(this,\s*(\w+)::class\.java\)/.exec(clickContent);
        if (intentMatch) {
            return {
                type: 'navigation',
                target: intentMatch[1],
                description: "Start ".concat(intentMatch[1], " activity"),
            };
        }
        // Fragment transactions
        var fragmentMatch = /(\w+)Fragment\(\)/.exec(clickContent);
        if (fragmentMatch) {
            return {
                type: 'navigation',
                target: fragmentMatch[1],
                description: "Show ".concat(fragmentMatch[1], " fragment"),
            };
        }
        return undefined;
    };
    KotlinAnalyzer.prototype.removeDialogContent = function (content) {
        // Remove AlertDialog, DialogFragment, etc.
        var dialogPatterns = [
            /AlertDialog\.Builder[^}]*create\(\)/g,
            /DialogFragment\(\)/g,
            /show\(\)/g, // Generic show calls in dialog context
        ];
        var cleanContent = content;
        for (var _i = 0, dialogPatterns_1 = dialogPatterns; _i < dialogPatterns_1.length; _i++) {
            var pattern = dialogPatterns_1[_i];
            cleanContent = cleanContent.replace(pattern, '/* dialog removed */');
        }
        return cleanContent;
    };
    KotlinAnalyzer.prototype.extractScreenName = function (fileName) {
        return fileName
            .replace(/Activity|Fragment|Screen/g, '')
            .replace(/([A-Z])/g, ' $1')
            .trim();
    };
    KotlinAnalyzer.prototype.parseRoutes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var routes, navFiles, _i, navFiles_1, file, content, fragmentRegex, match;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        routes = [];
                        return [4 /*yield*/, this.findFiles(['**/navigation/*.xml'])];
                    case 1:
                        navFiles = _a.sent();
                        _i = 0, navFiles_1 = navFiles;
                        _a.label = 2;
                    case 2:
                        if (!(_i < navFiles_1.length)) return [3 /*break*/, 5];
                        file = navFiles_1[_i];
                        return [4 /*yield*/, fs_extra_1.default.readFile(file, 'utf-8')];
                    case 3:
                        content = _a.sent();
                        fragmentRegex = /<fragment[^>]*android:id="@\+id\/([^"]+)"[^>]*android:name="[^"]*\.(\w+)"/g;
                        match = void 0;
                        while ((match = fragmentRegex.exec(content)) !== null) {
                            routes.push({
                                name: match[1],
                                path: match[1], // Use fragment ID as path
                                screen: match[2],
                            });
                        }
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, routes];
                }
            });
        });
    };
    // Additional method to parse XML layouts
    KotlinAnalyzer.prototype.parseLayoutFiles = function () {
        return __awaiter(this, void 0, void 0, function () {
            var widgets, layoutFiles, _i, layoutFiles_1, file, content, textViewRegex, match, text, buttonRegex, editTextRegex;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        widgets = [];
                        return [4 /*yield*/, this.findFiles(['**/layout/*.xml'])];
                    case 1:
                        layoutFiles = _a.sent();
                        _i = 0, layoutFiles_1 = layoutFiles;
                        _a.label = 2;
                    case 2:
                        if (!(_i < layoutFiles_1.length)) return [3 /*break*/, 5];
                        file = layoutFiles_1[_i];
                        return [4 /*yield*/, fs_extra_1.default.readFile(file, 'utf-8')];
                    case 3:
                        content = _a.sent();
                        textViewRegex = /<TextView[^>]*(?:android:text="([^"]+)"|android:hint="([^"]+)")/g;
                        match = void 0;
                        while ((match = textViewRegex.exec(content)) !== null) {
                            text = match[1] || match[2];
                            if (text) {
                                widgets.push({
                                    type: 'text',
                                    value: text,
                                });
                            }
                        }
                        buttonRegex = /<Button[^>]*android:text="([^"]+)"/g;
                        while ((match = buttonRegex.exec(content)) !== null) {
                            widgets.push({
                                type: 'button',
                                label: match[1],
                            });
                        }
                        editTextRegex = /<EditText[^>]*android:hint="([^"]+)"/g;
                        while ((match = editTextRegex.exec(content)) !== null) {
                            widgets.push({
                                type: 'input',
                                label: match[1],
                            });
                        }
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, widgets];
                }
            });
        });
    };
    KotlinAnalyzer.prototype.findFiles = function (patterns) {
        return __awaiter(this, void 0, void 0, function () {
            var files, scanDir;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        files = [];
                        scanDir = function (dir) { return __awaiter(_this, void 0, void 0, function () {
                            var entries, _i, entries_1, entry, fullPath, fileName, _a, patterns_1, pattern, error_1;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 8, , 9]);
                                        return [4 /*yield*/, fs_extra_1.default.readdir(dir, { withFileTypes: true })];
                                    case 1:
                                        entries = _b.sent();
                                        _i = 0, entries_1 = entries;
                                        _b.label = 2;
                                    case 2:
                                        if (!(_i < entries_1.length)) return [3 /*break*/, 7];
                                        entry = entries_1[_i];
                                        fullPath = path_1.default.join(dir, entry.name);
                                        if (!entry.isDirectory()) return [3 /*break*/, 5];
                                        if (!!['build', '.git', 'gradle'].includes(entry.name)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, scanDir(fullPath)];
                                    case 3:
                                        _b.sent();
                                        _b.label = 4;
                                    case 4: return [3 /*break*/, 6];
                                    case 5:
                                        if (entry.isFile()) {
                                            fileName = entry.name.toLowerCase();
                                            if (fileName.endsWith('.kt') || fileName.endsWith('.java') || fileName.endsWith('.xml')) {
                                                // Check if matches any pattern
                                                for (_a = 0, patterns_1 = patterns; _a < patterns_1.length; _a++) {
                                                    pattern = patterns_1[_a];
                                                    if (this.matchesPattern(fullPath, pattern)) {
                                                        files.push(fullPath);
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                        _b.label = 6;
                                    case 6:
                                        _i++;
                                        return [3 /*break*/, 2];
                                    case 7: return [3 /*break*/, 9];
                                    case 8:
                                        error_1 = _b.sent();
                                        return [3 /*break*/, 9];
                                    case 9: return [2 /*return*/];
                                }
                            });
                        }); };
                        return [4 /*yield*/, scanDir(this.projectDir)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, files];
                }
            });
        });
    };
    KotlinAnalyzer.prototype.matchesPattern = function (filePath, pattern) {
        // Simple pattern matching
        var relativePath = path_1.default.relative(this.projectDir, filePath);
        return relativePath.includes(pattern.replace('**/', '').replace('*.', '.'));
    };
    KotlinAnalyzer.prototype.escapeRegex = function (str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    return KotlinAnalyzer;
}());
exports.KotlinAnalyzer = KotlinAnalyzer;
