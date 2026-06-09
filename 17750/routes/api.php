<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CardController;
use App\Http\Controllers\CollectionController;
use App\Http\Controllers\DeckController;
use App\Http\Controllers\MatchController;
use App\Http\Controllers\MetaController;

Route::prefix('v1')->middleware('auth:sanctum')->group(function () {

    Route::prefix('cards')->group(function () {
        Route::get('/', [CardController::class, 'index'])->middleware('throttle:100,1');
        Route::get('/autocomplete', [CardController::class, 'autocomplete'])->middleware('throttle:200,1');
        Route::get('/random', [CardController::class, 'random'])->middleware('throttle:60,1');
        Route::get('/{card}', [CardController::class, 'show'])->middleware('throttle:100,1');
        Route::get('/{card}/price-history', [CardController::class, 'priceHistory'])->middleware('throttle:60,1');
        Route::post('/sync', [CardController::class, 'sync'])->middleware('throttle:5,1');
        Route::post('/sync/full', [CardController::class, 'syncFull'])->middleware('throttle:1,60');
    });

    Route::prefix('collection')->group(function () {
        Route::get('/', [CollectionController::class, 'index'])->middleware('throttle:60,1');
        Route::post('/', [CollectionController::class, 'store'])->middleware('throttle:30,1');
        Route::get('/stats', [CollectionController::class, 'stats'])->middleware('throttle:60,1');
        Route::get('/{item}', [CollectionController::class, 'show'])->middleware('throttle:60,1');
        Route::put('/{item}', [CollectionController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/{item}', [CollectionController::class, 'destroy'])->middleware('throttle:30,1');
        Route::post('/import/csv', [CollectionController::class, 'importCsv'])->middleware('throttle:5,1');
        Route::post('/import/json', [CollectionController::class, 'importJson'])->middleware('throttle:5,1');
        Route::get('/export/csv', [CollectionController::class, 'exportCsv'])->middleware('throttle:20,1');
        Route::get('/export/json', [CollectionController::class, 'exportJson'])->middleware('throttle:20,1');
    });

    Route::prefix('decks')->group(function () {
        Route::get('/', [DeckController::class, 'index'])->middleware('throttle:60,1');
        Route::post('/', [DeckController::class, 'store'])->middleware('throttle:20,1');
        Route::get('/{deck}', [DeckController::class, 'show'])->middleware('throttle:60,1');
        Route::put('/{deck}', [DeckController::class, 'update'])->middleware('throttle:20,1');
        Route::delete('/{deck}', [DeckController::class, 'destroy'])->middleware('throttle:20,1');
        Route::get('/{deck}/validate', [DeckController::class, 'validate'])->middleware('throttle:30,1');
        Route::get('/{deck}/export/mtgo', [DeckController::class, 'exportMtgo'])->middleware('throttle:20,1');
        Route::get('/{deck}/export/mws', [DeckController::class, 'exportMws'])->middleware('throttle:20,1');
        Route::get('/{deck}/export/txt', [DeckController::class, 'exportTxt'])->middleware('throttle:20,1');
        Route::post('/{deck}/import/mws', [DeckController::class, 'importMws'])->middleware('throttle:5,1');
        Route::get('/recommendations', [DeckController::class, 'recommendations'])->middleware('throttle:10,1');
    });

    Route::prefix('matches')->group(function () {
        Route::get('/', [MatchController::class, 'index'])->middleware('throttle:60,1');
        Route::post('/', [MatchController::class, 'store'])->middleware('throttle:30,1');
        Route::get('/stats', [MatchController::class, 'stats'])->middleware('throttle:60,1');
        Route::get('/analysis', [MatchController::class, 'analysis'])->middleware('throttle:60,1');
        Route::get('/{match}', [MatchController::class, 'show'])->middleware('throttle:60,1');
        Route::put('/{match}', [MatchController::class, 'update'])->middleware('throttle:30,1');
        Route::delete('/{match}', [MatchController::class, 'destroy'])->middleware('throttle:30,1');
        Route::get('/export/json', [MatchController::class, 'exportJson'])->middleware('throttle:20,1');
    });

    Route::prefix('meta')->group(function () {
        Route::get('/', [MetaController::class, 'index'])->middleware('throttle:60,1');
        Route::post('/', [MetaController::class, 'store'])->middleware('throttle:20,1');
        Route::get('/latest', [MetaController::class, 'latest'])->middleware('throttle:60,1');
        Route::get('/trend', [MetaController::class, 'trend'])->middleware('throttle:60,1');
        Route::get('/compare', [MetaController::class, 'compare'])->middleware('throttle:60,1');
        Route::post('/import', [MetaController::class, 'import'])->middleware('throttle:5,1');
        Route::get('/{snapshot}', [MetaController::class, 'show'])->middleware('throttle:60,1');
        Route::delete('/{snapshot}', [MetaController::class, 'destroy'])->middleware('throttle:20,1');
        Route::get('/archetype/{archetype}/history', [MetaController::class, 'archetypeHistory'])->middleware('throttle:60,1');
    });
});
