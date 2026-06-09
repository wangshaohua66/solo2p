<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cards', function (Blueprint $table) {
            $table->id();
            $table->string('scryfall_id')->unique()->index();
            $table->string('oracle_id')->index();
            $table->string('name');
            $table->string('name_normalized')->index();
            $table->text('oracle_text')->nullable();
            $table->string('mana_cost')->nullable();
            $table->integer('cmc')->default(0)->index();
            $table->json('colors')->nullable();
            $table->json('color_identity')->nullable();
            $table->string('type_line');
            $table->json('card_types')->nullable();
            $table->json('subtypes')->nullable();
            $table->json('supertypes')->nullable();
            $table->string('rarity')->index();
            $table->string('set_code')->index();
            $table->string('set_name');
            $table->string('collector_number');
            $table->string('language')->default('en');
            $table->boolean('is_foil')->default(false);
            $table->boolean('is_full_art')->default(false);
            $table->boolean('is_promo')->default(false);
            $table->decimal('price_usd', 10, 2)->nullable();
            $table->decimal('price_eur', 10, 2)->nullable();
            $table->decimal('price_tix', 10, 2)->nullable();
            $table->string('image_small')->nullable();
            $table->string('image_normal')->nullable();
            $table->string('image_large')->nullable();
            $table->string('artist')->nullable();
            $table->string('power')->nullable();
            $table->string('toughness')->nullable();
            $table->string('loyalty')->nullable();
            $table->json('legalities')->nullable();
            $table->json('keywords')->nullable();
            $table->text('flavor_text')->nullable();
            $table->integer('edhrec_rank')->nullable()->index();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();

            $table->index(['rarity', 'set_code']);
            $table->index(['cmc', 'colors']);
            $table->index(['name_normalized', 'set_code']);
        });

        DB::statement('CREATE INDEX cards_oracle_text_fulltext ON cards(oracle_text COLLATE NOCASE);');
        DB::statement('CREATE INDEX cards_name_fulltext ON cards(name COLLATE NOCASE);');
    }

    public function down(): void
    {
        Schema::dropIfExists('cards');
    }
};
