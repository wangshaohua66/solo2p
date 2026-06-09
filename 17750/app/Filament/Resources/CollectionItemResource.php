<?php

namespace App\Filament\Resources;

use App\Filament\Resources\CollectionItemResource\Pages;
use App\Models\CollectionItem;
use App\Models\Card;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Actions\BulkAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class CollectionItemResource extends Resource
{
    protected static ?string $model = CollectionItem::class;

    protected static ?string $navigationIcon = 'heroicon-o-archive-box';

    protected static ?string $navigationGroup = 'Collection';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Select::make('card_id')
                    ->relationship('card', 'name')
                    ->searchable()
                    ->preload()
                    ->required(),
                Forms\Components\TextInput::make('quantity')
                    ->required()
                    ->numeric()
                    ->minValue(1)
                    ->default(1),
                Forms\Components\Select::make('condition')
                    ->options([
                        'NM' => 'Near Mint',
                        'SP' => 'Slightly Played',
                        'MP' => 'Moderately Played',
                        'HP' => 'Heavily Played',
                        'DMG' => 'Damaged',
                    ])
                    ->required()
                    ->default('NM'),
                Forms\Components\Toggle::make('is_foil')
                    ->default(false),
                Forms\Components\Select::make('language')
                    ->options([
                        'en' => 'English',
                        'zh-CN' => 'Chinese (Simplified)',
                        'ja' => 'Japanese',
                        'de' => 'German',
                        'fr' => 'French',
                        'es' => 'Spanish',
                        'it' => 'Italian',
                        'pt' => 'Portuguese',
                        'ru' => 'Russian',
                        'ko' => 'Korean',
                    ])
                    ->required()
                    ->default('en'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                ImageColumn::make('card.image_small')
                    ->label('Card')
                    ->height(60)
                    ->width(45),
                TextColumn::make('card.name')
                    ->label('Name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('card.set_code')
                    ->label('Set')
                    ->sortable(),
                TextColumn::make('quantity')
                    ->sortable()
                    ->summarize(Tables\Columns\Summarizers\Sum::make()),
                TextColumn::make('condition')
                    ->sortable(),
                IconColumn::make('is_foil')
                    ->boolean()
                    ->label('Foil'),
                TextColumn::make('language')
                    ->sortable(),
                TextColumn::make('card.price_usd')
                    ->label('Price (USD)')
                    ->money('USD')
                    ->sortable(),
                TextColumn::make('total_value')
                    ->label('Total Value')
                    ->getStateUsing(fn ($record) => $record->card?->price_usd * $record->quantity)
                    ->money('USD')
                    ->sortable(query: function (Builder $query, string $direction) {
                        $query->join('cards', 'collection_items.card_id', '=', 'cards.id')
                            ->orderByRaw('cards.price_usd * collection_items.quantity ' . $direction);
                    }),
            ])
            ->filters([
                SelectFilter::make('condition')
                    ->options([
                        'NM' => 'Near Mint',
                        'SP' => 'Slightly Played',
                        'MP' => 'Moderately Played',
                        'HP' => 'Heavily Played',
                    ]),
                TernaryFilter::make('is_foil')
                    ->label('Foil'),
                SelectFilter::make('language')
                    ->options([
                        'en' => 'English',
                        'zh-CN' => 'Chinese (Simplified)',
                        'ja' => 'Japanese',
                    ]),
                SelectFilter::make('card.set_code')
                    ->label('Set')
                    ->options(fn () => Card::distinct()->pluck('set_code', 'set_code')->sort()),
            ])
            ->bulkActions([
                BulkAction::make('updateCondition')
                    ->label('Update Condition')
                    ->form([
                        Forms\Components\Select::make('condition')
                            ->options([
                                'NM' => 'Near Mint',
                                'SP' => 'Slightly Played',
                                'MP' => 'Moderately Played',
                                'HP' => 'Heavily Played',
                                'DMG' => 'Damaged',
                            ])
                            ->required(),
                    ])
                    ->action(function (Collection $records, array $data) {
                        $records->each->update(['condition' => $data['condition']]);
                    })
                    ->deselectRecordsAfterCompletion(),

                BulkAction::make('updateLanguage')
                    ->label('Update Language')
                    ->form([
                        Forms\Components\Select::make('language')
                            ->options([
                                'en' => 'English',
                                'zh-CN' => 'Chinese (Simplified)',
                                'ja' => 'Japanese',
                                'de' => 'German',
                                'fr' => 'French',
                                'es' => 'Spanish',
                                'it' => 'Italian',
                                'pt' => 'Portuguese',
                                'ru' => 'Russian',
                                'ko' => 'Korean',
                            ])
                            ->required(),
                    ])
                    ->action(function (Collection $records, array $data) {
                        $records->each->update(['language' => $data['language']]);
                    })
                    ->deselectRecordsAfterCompletion(),

                BulkAction::make('markFoil')
                    ->label('Mark as Foil')
                    ->action(fn (Collection $records) => $records->each->update(['is_foil' => true]))
                    ->deselectRecordsAfterCompletion(),

                BulkAction::make('markNonFoil')
                    ->label('Mark as Non-Foil')
                    ->action(fn (Collection $records) => $records->each->update(['is_foil' => false]))
                    ->deselectRecordsAfterCompletion(),

                BulkAction::make('increaseQuantity')
                    ->label('Increase Quantity')
                    ->form([
                        Forms\Components\TextInput::make('amount')
                            ->required()
                            ->numeric()
                            ->minValue(1)
                            ->default(1),
                    ])
                    ->action(function (Collection $records, array $data) {
                        $records->each->increment('quantity', $data['amount']);
                    })
                    ->deselectRecordsAfterCompletion(),

                BulkAction::make('decreaseQuantity')
                    ->label('Decrease Quantity')
                    ->form([
                        Forms\Components\TextInput::make('amount')
                            ->required()
                            ->numeric()
                            ->minValue(1)
                            ->default(1),
                    ])
                    ->action(function (Collection $records, array $data) {
                        $records->each->decrement('quantity', $data['amount']);
                    })
                    ->deselectRecordsAfterCompletion(),

                BulkAction::make('delete')
                    ->label('Delete Selected')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->action(fn (Collection $records) => $records->each->delete())
                    ->deselectRecordsAfterCompletion(),
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
            'index' => Pages\ListCollectionItems::route('/'),
            'create' => Pages\CreateCollectionItem::route('/create'),
            'edit' => Pages\EditCollectionItem::route('/{record}/edit'),
        ];
    }
}
