const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');

// Khai báo biến supabase ở phạm vi toàn cục của file này
let supabase;

/**
 * Hàm khởi tạo kết nối Supabase bằng Key truyền vào từ server.js
 */
function initSupabaseService(url, key) {
    if (!supabase) {
        supabase = createClient(url, key);
    }
}

const providers = {
    polygon: new ethers.JsonRpcProvider('https://polygon-rpc.com'),
    sepolia: new ethers.JsonRpcProvider('https://sepolia.org')
};
const ERC721_ABI = ["function ownerOf(uint256 tokenId) view returns (address)"];

async function checkAccessRights(userWallet, contractAddress, tokenId) {
    if (!userWallet || userWallet === '0x0000000000000000000000000000000000000000') return false;

    // Nếu chưa được khởi tạo, trả về false để bảo mật
    if (!supabase) {
        console.error("❌ Supabase Service chưa được khởi tạo từ server.js");
        return false;
    }

    const wallet = userWallet.toLowerCase();
    const contractAddr = contractAddress.toLowerCase();

    try {
        const { data: collection, error } = await supabase
            .from('collections')
            .select('*')
            .eq('contract_address', contractAddr)
            .single();

        if (error || !collection) return false;

        // Thay đổi tên trường cho khớp với database của bạn (ví dụ: creator_wallet)
        if (collection.creator_wallet && collection.creator_wallet.toLowerCase() === wallet) {
            return true;
        }

        const network = collection.network || 'polygon';
        const provider = providers[network];
        const contract = new ethers.Contract(contractAddr, ERC721_ABI, provider);

        const currentOwner = await contract.ownerOf(tokenId);
        return currentOwner.toLowerCase() === wallet;
    } catch (error) {
        console.error("Lỗi xác thực nhạc:", error);
        return false;
    }
}

// Xuất khẩu cả hàm check quyền và hàm khởi tạo động
module.exports = { checkAccessRights, initSupabaseService };
