package formula

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/remote-sensing/sentinel-cli/internal/types"
)

type Token struct {
	Type  string
	Value string
	Op    rune
	Num   float64
	Band  string
}

func BuildBandMap(meta *types.GeoTIFFMetadata) map[string]int {
	bandMap := make(map[string]int)
	for i, band := range meta.Bands {
		key := strings.ToUpper(fmt.Sprintf("B%d", band.Index))
		bandMap[key] = i
		altKey := strings.ToLower(fmt.Sprintf("b%d", band.Index))
		bandMap[altKey] = i
	}
	return bandMap
}

func Tokenize(formula string, bandMap map[string]int) []Token {
	var tokens []Token
	re := regexp.MustCompile(`([Bb]\d+[Aa]?|\d+\.?\d*|[+\-*/()])`)
	matches := re.FindAllString(formula, -1)
	for _, match := range matches {
		switch {
		case strings.ContainsAny(match, "+-*/()"):
			tokens = append(tokens, Token{Type: "op", Op: rune(match[0])})
		case regexp.MustCompile(`^[Bb]\d`).MatchString(match):
			upper := strings.ToUpper(match)
			if _, ok := bandMap[upper]; ok {
				tokens = append(tokens, Token{Type: "band", Band: upper})
			}
		default:
			if num, err := strconv.ParseFloat(match, 64); err == nil {
				tokens = append(tokens, Token{Type: "num", Num: num})
			}
		}
	}
	return tokens
}

func Evaluate(tokens []Token, values map[string]float64, noData float64) float64 {
	if len(tokens) == 0 {
		return noData
	}
	var output []Token
	var opStack []rune
	precedence := map[rune]int{'(': 0, ')': 0, '+': 1, '-': 1, '*': 2, '/': 2}
	for _, tok := range tokens {
		switch tok.Type {
		case "num", "band":
			output = append(output, tok)
		case "op":
			if tok.Op == '(' {
				opStack = append(opStack, tok.Op)
			} else if tok.Op == ')' {
				for len(opStack) > 0 && opStack[len(opStack)-1] != '(' {
					output = append(output, Token{Type: "op", Op: opStack[len(opStack)-1]})
					opStack = opStack[:len(opStack)-1]
				}
				if len(opStack) > 0 {
					opStack = opStack[:len(opStack)-1]
				}
			} else {
				for len(opStack) > 0 && precedence[opStack[len(opStack)-1]] >= precedence[tok.Op] && opStack[len(opStack)-1] != '(' {
					output = append(output, Token{Type: "op", Op: opStack[len(opStack)-1]})
					opStack = opStack[:len(opStack)-1]
				}
				opStack = append(opStack, tok.Op)
			}
		}
	}
	for len(opStack) > 0 {
		output = append(output, Token{Type: "op", Op: opStack[len(opStack)-1]})
		opStack = opStack[:len(opStack)-1]
	}
	var stack []float64
	for _, tok := range output {
		switch tok.Type {
		case "num":
			stack = append(stack, tok.Num)
		case "band":
			if v, ok := values[tok.Band]; ok {
				stack = append(stack, v)
			} else {
				stack = append(stack, noData)
			}
		case "op":
			if len(stack) < 2 {
				return noData
			}
			b := stack[len(stack)-1]
			a := stack[len(stack)-2]
			stack = stack[:len(stack)-2]
			switch tok.Op {
			case '+':
				stack = append(stack, a+b)
			case '-':
				stack = append(stack, a-b)
			case '*':
				stack = append(stack, a*b)
			case '/':
				if b == 0 || math.IsNaN(a) || math.IsNaN(b) {
					stack = append(stack, noData)
				} else {
					stack = append(stack, a/b)
				}
			}
		}
	}
	if len(stack) == 1 {
		return stack[0]
	}
	return noData
}
