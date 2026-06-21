package simhash

import (
	"crypto/md5"
	"encoding/binary"
	"strings"
	"unicode"
)

func Compute(text string) uint64 {
	words := tokenize(text)
	if len(words) == 0 {
		return 0
	}

	vector := make([]int, 64)

	for _, word := range words {
		hash := hashWord(word)
		weight := len(word)

		for i := 0; i < 64; i++ {
			bit := (hash >> uint(i)) & 1
			if bit == 1 {
				vector[i] += weight
			} else {
				vector[i] -= weight
			}
		}
	}

	var fingerprint uint64
	for i := 0; i < 64; i++ {
		if vector[i] > 0 {
			fingerprint |= 1 << uint(i)
		}
	}

	return fingerprint
}

func Similarity(h1, h2 uint64) float64 {
	distance := hammingDistance(h1, h2)
	return float64(64-distance) / 64.0 * 100
}

func hammingDistance(x, y uint64) int {
	xor := x ^ y
	distance := 0
	for xor != 0 {
		distance++
		xor &= xor - 1
	}
	return distance
}

func hashWord(word string) uint64 {
	h := md5.Sum([]byte(word))
	return binary.LittleEndian.Uint64(h[:8])
}

func tokenize(text string) []string {
	text = strings.ToLower(text)
	var words []string
	var current strings.Builder

	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			current.WriteRune(r)
		} else {
			if current.Len() >= 2 {
				words = append(words, current.String())
			}
			current.Reset()
		}
	}

	if current.Len() >= 2 {
		words = append(words, current.String())
	}

	return words
}
