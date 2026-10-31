<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CodeVerification extends Model
{
    protected $table = 'codes_verification';

    protected $guarded = [];

    protected $casts = [
        'expire_le' => 'datetime',
        'verifie_le' => 'datetime',
        'utilise_le' => 'datetime',
    ];
}
