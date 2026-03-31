

## Plan: Sales Cart Table — Sqft ফিল্ড Editable করা

### সমস্যা
কার্ট টেবলে প্রোডাক্ট অ্যাড করার পর **Sqft./Qty.** কলামটি শুধু টেক্সট হিসেবে দেখায়, এডিট করা যায় না। Carton ও Piece এডিটেবল কিন্তু Sqft নয়।

### সমাধান
**File: `src/components/screens/SalesScreen.tsx`** — Line 839

Plain text `{item.sqftQty.toFixed(3)}` কে একটি editable `<input>` দিয়ে replace করা হবে:

- SQFT আইটেমের জন্য sqftQty ফিল্ডে `<input type="number">` বসবে
- `onChange` এ `updateItem(item.id, 'sqftQty', value)` কল হবে
- যেহেতু `updateItem` function এ ইতিমধ্যে `sqftQty` field handle করা আছে (line 282-285 — `calcCartonPieceFromSqft` দিয়ে carton/piece auto-calculate হয়), তাই শুধু input element যোগ করলেই কাজ হবে

### পরিবর্তন
একটি মাত্র লাইন পরিবর্তন — line 839:

**আগে:**
```
<td className="...">{item.sqftQty > 0 ? item.sqftQty.toFixed(3) : '0'}</td>
```

**পরে:**
```
<td className="px-1 py-1">
  <input type="number" min={0} step="0.001" value={item.sqftQty}
    onChange={e => updateItem(item.id, 'sqftQty', parseFloat(e.target.value) || 0)}
    className="w-20 bg-white dark:bg-pos-surface-high border border-pos-surface-container rounded text-sm py-1.5 text-center outline-none focus:border-pos-secondary mx-auto block" />
</td>
```

এতে ব্যবহারকারী সরাসরি sqft value টাইপ করতে পারবে এবং carton/piece স্বয়ংক্রিয়ভাবে আপডেট হবে।

