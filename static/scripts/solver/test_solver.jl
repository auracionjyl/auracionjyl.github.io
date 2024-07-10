include("solver.jl")
using search
using JSON

function solve_batch(data_path, json_path)
    puzzles = []
    buffer = []
    lines = readlines(data_path)
    for line in lines
        line = strip(line)
        if startswith(line, "case")
            if length(buffer) > 0
                for i in [1, 2, 3, 4, 5, 6]
                    push!(puzzles, Dict("black" => buffer[1], "white" => buffer[2], "win_in_n" => i))
                end
                empty!(buffer)
            end
        else
            pieces = split(line, " = ")[2]
            pieces = JSON.parse(pieces)
            push!(buffer, pieces)
        end
    end
    for i in [1, 2, 3, 4, 5, 6]
        push!(puzzles, Dict("black" => buffer[1], "white" => buffer[2], "win_in_n" => i))
    end
    println(length(puzzles))

    all_time = search(puzzles, true)

    json_str = JSON.json(all_time)
    println(json_str)
    Base.open("$json_path", "w") do file
        write(file, json_str)
    end
end

solve_batch("./data/shucheng_puzzles", "./data/shucheng_time.json")
solve_batch("./data/jeroen_puzzles", "./data/jeroen_time.json")
