<?php

namespace App\Filament\Resources\CollectionItemResource\Pages;

use App\Filament\Resources\CollectionItemResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListCollectionItems extends ListRecords
{
    protected static string $resource = CollectionItemResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
