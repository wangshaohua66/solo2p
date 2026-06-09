<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CardResource\Pages;
use App\Models\Card;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Filters\SelectFilter;
use Illuminate\Database\Eloquent\Builder;

class CardResource extends Resource
{
    protected static ?string $model = Card::class;

    protected static ?string $navigationIcon = 'heroicon-o-rectangle-stack';

    protected static ?string $navigationGroup = 'Cards';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->required()
                    ->maxLength(255),
                Forms\Components\TextInput::make('mana_cost')
                    ->maxLength(255),
                Forms\Components\TextInput::make('cmc')
                    ->required()
                    ->numeric(),
                Forms\Components\TextInput::make('type_line')
                    ->required()
                    ->maxLength(255),
                Forms\Components\Textarea::make('oracle_text')
                    ->maxLength(65535)
                    ->columnSpanFull(),
                Forms\Components\TagsInput::make('colors')
                    ->placeholder('Add color'),
                Forms\Components\TagsInput::make('color_identity')
                    ->placeholder('Add color identity'),
                Forms\Components\TagsInput::make('keywords')
                    ->placeholder('Add keyword'),
                Forms\Components\Select::make('rarity')
                    ->options([
                        'common' => 'Common',
                        'uncommon' => 'Uncommon',
                        'rare' => 'Rare',
                        'mythic' => 'Mythic Rare',
                    ])
                    ->required(),
                Forms\Components\TextInput::make('set_code')
                    ->required()
                    ->maxLength(10),
                Forms\Components\TextInput::make('set_name')
                    ->required()
                    ->maxLength(255),
                Forms\Components\TextInput::make('collector_number')
                    ->maxLength(10),
                Forms\Components\TextInput::make('language')
                    ->required()
                    ->maxLength(10)
                    ->default('en'),
                Forms\Components\Toggle::make('is_foil'),
                Forms\Components\TextInput::make('price_usd')
                    ->numeric()
                    ->prefix('$'),
                Forms\Components\TextInput::make('price_eur')
                    ->numeric()
                    ->prefix('€'),
                Forms\Components\TextInput::make('price_tix')
                    ->numeric(),
                Forms\Components\TextInput::make('artist')
                    ->maxLength(255),
                Forms\Components\TextInput::make('power')
                    ->maxLength(10),
                Forms\Components\TextInput::make('toughness')
                    ->maxLength(10),
                Forms\Components\TextInput::make('loyalty')
                    ->numeric(),
                Forms\Components\DatePicker::make('released_at'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                ImageColumn::make('image_small')
                    ->label('Card')
                    ->height(60)
                    ->width(45),
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('type_line')
                    ->searchable()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('mana_cost')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('cmc')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('set_code')
                    ->sortable()
                    ->searchable(),
                TextColumn::make('rarity')
                    ->sortable()
                    ->searchable(),
                IconColumn::make('is_foil')
                    ->boolean()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('language')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('price_usd')
                    ->money('USD')
                    ->sortable(),
                TextColumn::make('price_eur')
                    ->money('EUR')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('released_at')
                    ->date()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('rarity')
                    ->options([
                        'common' => 'Common',
                        'uncommon' => 'Uncommon',
                        'rare' => 'Rare',
                        'mythic' => 'Mythic Rare',
                    ]),
                SelectFilter::make('set_code')
                    ->label('Set')
                    ->options(fn () => Card::distinct()->pluck('set_code', 'set_code')->sort()),
                SelectFilter::make('language')
                    ->options([
                        'en' => 'English',
                        'zh-CN' => 'Chinese (Simplified)',
                        'ja' => 'Japanese',
                    ]),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\DeleteAction::make(),
            ])
            ->headerActions([
                Tables\Actions\CreateAction::make(),
            ]);
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCards::route('/'),
            'create' => Pages\CreateCard::route('/create'),
            'edit' => Pages\EditCard::route('/{record}/edit'),
        ];
    }
}
